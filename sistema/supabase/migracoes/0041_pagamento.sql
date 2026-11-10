-- ============================================================
-- BARBOS — migração 0041: pagamento
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Pode rodar mais de uma vez sem quebrar.
--
-- A barbearia só entra no sistema com o pagamento em dia. Quem diz isso é
-- `barbearias.pagamento_ativo`, e quem mexe nela é SÓ o banco:
--
--   - o webhook do Asaas (`asaas_evento`), a cada pagamento que entra, volta
--     ou atrasa;
--   - o agendador (pg_cron), uma vez por dia, para quem passou do prazo;
--   - as ferramentas de liberar e bloquear na mão (`liberar_barbearia`,
--     `bloquear_barbearia`, `gerar_convites`), que só rodam no SQL Editor.
--
-- A coluna é um RESULTADO, recalculado a partir dos pedidos. A regra:
--
--   mensal   vale até o próximo vencimento + 7 dias de tolerância
--   anual    vale 12 meses a partir do pagamento, sem tolerância
--   manual   vale até alguém bloquear (as barbearias liberadas por fora)
--
-- As barbearias que já existiam ganham um pedido "manual" aqui embaixo e
-- continuam entrando como sempre entraram.
--
-- A chave service_role continua fora do sistema: as funções que o servidor
-- chama são `security definer` e exigem um segredo que só o servidor e o
-- banco conhecem (tabela `segredos`). Sem ele, a chave anon pública não
-- consegue liberar barbearia nenhuma.
-- ============================================================

-- ---------- a coluna ----------
alter table public.barbearias
  add column if not exists pagamento_ativo boolean not null default false;

comment on column public.barbearias.pagamento_ativo is
  'Libera o sistema. Escrita só pelo banco (webhook do Asaas, agendador e liberação manual) — 0041.';

-- A política "edita a propria barbearia" deixa a dona mudar a própria
-- linha, e a tabela tem GRANT de UPDATE para authenticated. Sem esta trava,
-- qualquer conta se liberaria com um update de uma linha. Dentro de uma
-- função `security definer` o current_user é o dono da função, e a mudança
-- passa.
create or replace function public.proteger_pagamento_ativo()
returns trigger
language plpgsql
as $$
begin
  if new.pagamento_ativo is distinct from old.pagamento_ativo
     and current_user in ('anon', 'authenticated') then
    new.pagamento_ativo := old.pagamento_ativo;
  end if;
  return new;
end $$;

drop trigger if exists proteger_pagamento_ativo on public.barbearias;
create trigger proteger_pagamento_ativo
  before update of pagamento_ativo on public.barbearias
  for each row execute function public.proteger_pagamento_ativo();

-- ---------- pedidos: um por clique em "assinar" ----------
--
-- O `id` é o que viaja: vai para o Asaas como `externalReference` e volta
-- no endereço do cadastro (`/cadastrar?pedido=<id>`). É sorteado, e é por
-- isso que só quem pagou consegue usar.
create table if not exists public.pedidos (
  id                  uuid primary key default gen_random_uuid(),
  plano               text not null
                        check (plano in ('mensal', 'anual-cartao', 'anual-pix', 'manual')),
  situacao            text not null default 'aguardando'
                        check (situacao in ('aguardando', 'pago', 'cancelado', 'expirado', 'estornado')),
  barbearia_id        uuid references public.barbearias(id) on delete set null,
  checkout_id         text unique,
  asaas_cliente       text,
  asaas_assinatura    text,
  asaas_parcelamento  text,
  pago_em             timestamptz,
  -- Até quando o pagamento vale. Mensal: o próximo vencimento. Anual: 12
  -- meses depois do pagamento. Manual: vazio, vale até bloquear.
  acesso_ate          date,
  -- Só informativo: quando o Asaas avisou do atraso da mensalidade. Quem
  -- bloqueia é o prazo (`acesso_ate` + 7 dias), não este aviso.
  atrasado_desde      timestamptz,
  observacao          text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

comment on table public.pedidos is
  'Um pedido por clique em assinar (ou por liberação manual). Ninguém lê pela API — só as funções do banco. 0041.';

create index if not exists pedidos_barbearia on public.pedidos (barbearia_id);
create index if not exists pedidos_assinatura on public.pedidos (asaas_assinatura) where asaas_assinatura is not null;
create index if not exists pedidos_parcelamento on public.pedidos (asaas_parcelamento) where asaas_parcelamento is not null;

-- A `tocar_atualizada_em` da 0001 escreve em `atualizada_em` (feminino, de
-- barbearia); o pedido é masculino, e ganha a sua.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists tocar_pedidos on public.pedidos;
create trigger tocar_pedidos
  before update on public.pedidos
  for each row execute function public.tocar_atualizado_em();

-- ---------- o que o Asaas mandou, para não processar duas vezes ----------
create table if not exists public.eventos_asaas (
  id           text primary key,
  evento       text not null,
  recebido_em  timestamptz not null default now(),
  carga        jsonb not null
);

-- ---------- o segredo que o servidor apresenta ----------
-- O valor NÃO está neste arquivo: é gravado à parte, no mesmo dia em que
-- vira a variável ASAAS_WEBHOOK_TOKEN na Vercel e o token do webhook no
-- painel do Asaas. Ver supabase/manutencao/pagamento.sql.
create table if not exists public.segredos (
  nome   text primary key,
  valor  text not null
);

-- As três tabelas: RLS ligado e nenhuma política. A API não lê nem escreve
-- nelas; só as funções abaixo.
alter table public.pedidos enable row level security;
alter table public.eventos_asaas enable row level security;
alter table public.segredos enable row level security;
revoke all on public.pedidos, public.eventos_asaas, public.segredos from anon, authenticated;

-- ============================================================
-- A regra: esta barbearia está com o pagamento em dia?
-- ============================================================

create or replace function public.hoje_na_barbearia()
returns date
language sql
stable
as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.pagamento_em_dia(p_barbearia uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pedidos p
    where p.barbearia_id = p_barbearia
      and p.situacao = 'pago'
      and (
        (p.plano = 'manual'
          and (p.acesso_ate is null or p.acesso_ate >= public.hoje_na_barbearia()))
        or (p.plano = 'mensal'
          and p.acesso_ate + 7 >= public.hoje_na_barbearia())
        or (p.plano in ('anual-cartao', 'anual-pix')
          and p.acesso_ate >= public.hoje_na_barbearia())
      )
  )
$$;

create or replace function public.recalcular_pagamento(p_barbearia uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_barbearia is null then
    return;
  end if;
  update public.barbearias
     set pagamento_ativo = public.pagamento_em_dia(id)
   where id = p_barbearia
     and pagamento_ativo is distinct from public.pagamento_em_dia(id);
end $$;

-- O agendador chama esta, uma vez por dia: é o que bloqueia quem passou
-- do prazo sem que o Asaas precise avisar nada.
create or replace function public.recalcular_pagamentos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  mudaram integer;
begin
  update public.barbearias
     set pagamento_ativo = public.pagamento_em_dia(id)
   where pagamento_ativo is distinct from public.pagamento_em_dia(id);
  get diagnostics mudaram = row_count;
  return mudaram;
end $$;

create or replace function public.segredo_confere(p_segredo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_segredo is not null and exists (
    select 1 from public.segredos where nome = 'asaas_webhook' and valor = p_segredo
  )
$$;

-- ============================================================
-- Chamadas pelo servidor (com o segredo)
-- ============================================================

-- /assinar: guarda o pedido logo depois de abrir o checkout no Asaas.
-- `p_barbearia` vem preenchido quando quem assina já tem conta (renovação).
create or replace function public.registrar_pedido(
  p_segredo text,
  p_id uuid,
  p_plano text,
  p_checkout text,
  p_barbearia uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.segredo_confere(p_segredo) then
    raise exception 'segredo inválido' using errcode = '42501';
  end if;
  if p_plano not in ('mensal', 'anual-cartao', 'anual-pix') then
    raise exception 'plano desconhecido: %', p_plano;
  end if;

  insert into public.pedidos (id, plano, checkout_id, barbearia_id)
  values (p_id, p_plano, p_checkout, p_barbearia);
end $$;

-- O webhook do Asaas. Devolve o que fez, para o log do servidor.
create or replace function public.asaas_evento(p_segredo text, p_evento jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id           text := p_evento->>'id';
  v_tipo         text := p_evento->>'event';
  v_pagamento    jsonb := p_evento->'payment';
  v_checkout     text;
  v_assinatura   text;
  v_parcelamento text;
  v_pedido       public.pedidos%rowtype;
  v_vencimento   date;
  v_pago_no_dia  date;
begin
  if not public.segredo_confere(p_segredo) then
    raise exception 'segredo inválido' using errcode = '42501';
  end if;
  if v_id is null or v_tipo is null then
    return 'sem id';
  end if;

  -- O Asaas entrega "pelo menos uma vez": o mesmo evento pode chegar de
  -- novo. A chave primária faz o segundo virar nada.
  insert into public.eventos_asaas (id, evento, carga)
  values (v_id, v_tipo, p_evento)
  on conflict (id) do nothing;
  if not found then
    return 'repetido';
  end if;

  -- ---------- eventos do checkout ----------
  if v_tipo like 'CHECKOUT_%' then
    v_checkout := p_evento->'checkout'->>'id';
    select * into v_pedido from public.pedidos where checkout_id = v_checkout for update;
    if not found then
      return 'checkout de fora';
    end if;

    if v_tipo = 'CHECKOUT_PAID' then
      update public.pedidos
         set situacao = 'pago',
             pago_em = coalesce(pago_em, now()),
             acesso_ate = coalesce(
               acesso_ate,
               (public.hoje_na_barbearia()
                 + case when plano = 'mensal' then interval '1 month' else interval '12 months' end)::date
             )
       where id = v_pedido.id
         and situacao <> 'estornado';
    elsif v_tipo in ('CHECKOUT_EXPIRED', 'CHECKOUT_CANCELED') then
      update public.pedidos
         set situacao = case when v_tipo = 'CHECKOUT_EXPIRED' then 'expirado' else 'cancelado' end
       where id = v_pedido.id
         and situacao = 'aguardando';
    end if;

    perform public.recalcular_pagamento(v_pedido.barbearia_id);
    return lower(v_tipo);
  end if;

  -- ---------- eventos de cobrança ----------
  if v_pagamento is null then
    return 'ignorado';
  end if;

  v_checkout := v_pagamento->>'checkoutSession';
  v_assinatura := v_pagamento->>'subscription';
  v_parcelamento := v_pagamento->>'installment';

  -- Cada cobrança diz de onde veio: do checkout (a primeira), da assinatura
  -- (as mensalidades seguintes) ou do parcelamento (as parcelas do anual).
  select * into v_pedido
  from public.pedidos
  where (v_checkout is not null and checkout_id = v_checkout)
     or (v_assinatura is not null and asaas_assinatura = v_assinatura)
     or (v_parcelamento is not null and asaas_parcelamento = v_parcelamento)
  order by criado_em desc
  limit 1
  for update;
  if not found then
    return 'cobrança de fora';
  end if;

  v_vencimento := nullif(v_pagamento->>'dueDate', '')::date;
  v_pago_no_dia := coalesce(
    nullif(v_pagamento->>'paymentDate', '')::date,
    nullif(v_pagamento->>'confirmedDate', '')::date,
    v_vencimento,
    public.hoje_na_barbearia()
  );

  if v_tipo in ('PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED') then
    update public.pedidos
       set situacao = 'pago',
           pago_em = coalesce(pago_em, now()),
           atrasado_desde = null,
           asaas_cliente = coalesce(asaas_cliente, v_pagamento->>'customer'),
           asaas_assinatura = coalesce(asaas_assinatura, v_assinatura),
           asaas_parcelamento = coalesce(asaas_parcelamento, v_parcelamento),
           acesso_ate = case
             -- Mensal: cada mensalidade paga empurra o prazo para o
             -- vencimento seguinte. O maior vence: mensalidade paga
             -- atrasada não encolhe o prazo.
             when plano = 'mensal' then greatest(
               coalesce(acesso_ate, date '1900-01-01'),
               (coalesce(v_vencimento, v_pago_no_dia) + interval '1 month')::date
             )
             -- Anual: o prazo nasce na primeira parcela e não anda mais.
             -- As outras 11 parcelas do cartão não podem esticar o ano.
             else coalesce(acesso_ate, (v_pago_no_dia + interval '12 months')::date)
           end
     where id = v_pedido.id
       and situacao <> 'estornado';

  elsif v_tipo = 'PAYMENT_OVERDUE' then
    if v_pedido.situacao = 'aguardando' then
      -- Ninguém pagou a primeira cobrança (o PIX que venceu sem pagar).
      update public.pedidos set situacao = 'expirado' where id = v_pedido.id;
    else
      update public.pedidos
         set atrasado_desde = coalesce(atrasado_desde, now())
       where id = v_pedido.id;
    end if;

  elsif v_tipo in ('PAYMENT_REFUNDED', 'PAYMENT_CHARGEBACK_REQUESTED', 'PAYMENT_CHARGEBACK_DISPUTE') then
    update public.pedidos set situacao = 'estornado' where id = v_pedido.id;

  else
    return 'ignorado';
  end if;

  perform public.recalcular_pagamento(v_pedido.barbearia_id);
  return lower(v_tipo);
end $$;

-- ============================================================
-- Chamadas pela tela (sem segredo)
-- ============================================================

-- /cadastrar?pedido=<id>: o pedido existe? Foi pago? Já virou conta?
-- Sem segredo de propósito: o próprio id sorteado é a chave, e a resposta
-- não diz nada sobre quem pagou.
create or replace function public.situacao_do_pedido(p_id uuid)
returns table (situacao text, plano text, livre boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.situacao, p.plano, p.barbearia_id is null
  from public.pedidos p
  where p.id = p_id
$$;

-- /assinatura: o que dizer para a conta logada que está bloqueada.
create or replace function public.minha_assinatura()
returns table (pagamento_ativo boolean, plano text, situacao text, acesso_ate date)
language sql
stable
security definer
set search_path = public
as $$
  select b.pagamento_ativo, p.plano, p.situacao, p.acesso_ate
  from public.barbearias b
  left join lateral (
    select * from public.pedidos
    where barbearia_id = b.id and situacao <> 'aguardando'
    -- O pago vem primeiro: é ele que explica o acesso. Entre iguais, o
    -- mais recente.
    order by (situacao = 'pago') desc, coalesce(pago_em, criado_em) desc
    limit 1
  ) p on true
  where b.id = auth.uid()
$$;

-- ============================================================
-- Na mão, pelo SQL Editor (nenhuma delas é chamável pela API)
-- ============================================================

-- Libera uma barbearia que já tem conta, pelo e-mail do login.
create or replace function public.liberar_barbearia(p_email text, p_observacao text default null)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
  v_slug text;
begin
  select b.id, b.slug into v_barbearia, v_slug
  from auth.users u
  join public.barbearias b on b.id = u.id
  where lower(u.email) = lower(trim(p_email));
  if not found then
    return 'nenhuma barbearia com o e-mail ' || p_email;
  end if;

  insert into public.pedidos (plano, situacao, barbearia_id, pago_em, observacao)
  values ('manual', 'pago', v_barbearia, now(), coalesce(p_observacao, 'liberada na mão'));
  perform public.recalcular_pagamento(v_barbearia);
  return 'liberada: ' || v_slug;
end $$;

-- Desfaz a liberação manual. Se a barbearia também pagou pelo Asaas, ela
-- continua liberada pelo pagamento — e a resposta diz isso.
create or replace function public.bloquear_barbearia(p_email text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
  v_slug text;
begin
  select b.id, b.slug into v_barbearia, v_slug
  from auth.users u
  join public.barbearias b on b.id = u.id
  where lower(u.email) = lower(trim(p_email));
  if not found then
    return 'nenhuma barbearia com o e-mail ' || p_email;
  end if;

  update public.pedidos
     set situacao = 'cancelado', observacao = coalesce(observacao || ' · ', '') || 'bloqueada na mão'
   where barbearia_id = v_barbearia and plano = 'manual' and situacao = 'pago';
  perform public.recalcular_pagamento(v_barbearia);

  if public.pagamento_em_dia(v_barbearia) then
    return 'continua liberada pelo pagamento do Asaas: ' || v_slug;
  end if;
  return 'bloqueada: ' || v_slug;
end $$;

-- Para quem pagou por fora e ainda não tem conta: um link de cadastro por
-- barbearia, que já nasce liberado. Cada link vale para uma conta só.
create or replace function public.gerar_convites(p_quantidade integer default 1, p_observacao text default null)
returns table (link text)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with novos as (
    insert into public.pedidos (plano, situacao, pago_em, observacao)
    select 'manual', 'pago', now(), coalesce(p_observacao, 'convite')
    from generate_series(1, greatest(1, least(p_quantidade, 200)))
    returning id
  )
  select 'https://www.barboss.com.br/cadastrar?pedido=' || id::text from novos;
end $$;

-- ---------- quem pode chamar o quê ----------
-- O Supabase dá EXECUTE de toda função nova para anon e authenticated.
-- Aqui fica explícito: três são da API, o resto é só do banco.
revoke execute on function
  public.pagamento_em_dia(uuid),
  public.recalcular_pagamento(uuid),
  public.recalcular_pagamentos(),
  public.segredo_confere(text),
  public.liberar_barbearia(text, text),
  public.bloquear_barbearia(text),
  public.gerar_convites(integer, text),
  public.proteger_pagamento_ativo(),
  public.tocar_atualizado_em(),
  public.hoje_na_barbearia()
from public, anon, authenticated;

grant execute on function
  public.registrar_pedido(text, uuid, text, text, uuid),
  public.asaas_evento(text, jsonb),
  public.situacao_do_pedido(uuid)
to anon, authenticated;

revoke execute on function public.minha_assinatura() from public, anon;
grant execute on function public.minha_assinatura() to authenticated;

-- ============================================================
-- Cadastro: a conta nova traz o pedido pago, e nasce liberada
--
-- O corpo é o da 0021, igual, mais o bloco do pedido no fim. O pedido vem
-- em raw_user_meta_data.pedido (ver app/cadastrar/acoes.ts). Qualquer
-- problema com ele NUNCA derruba o cadastro: a conta nasce bloqueada e a
-- pessoa vê a tela de assinatura.
-- ============================================================

create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_barbearia text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'barbearia'), ''),
    'Minha barbearia'
  );
  v_pedido text := nullif(trim(new.raw_user_meta_data->>'pedido'), '');
begin
  begin
    insert into public.barbearias (id, nome, slug)
    values (new.id, nome_barbearia, public.slug_livre(nome_barbearia, new.id))
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.barbearias (id, nome, slug)
      values (
        new.id,
        nome_barbearia,
        coalesce(public.gerar_slug(nome_barbearia), 'barbearia')
          || '-' || left(replace(new.id::text, '-', ''), 6)
      )
      on conflict (id) do nothing;
  end;

  insert into public.configuracao_agenda (barbearia_id)
  values (new.id)
  on conflict (barbearia_id) do nothing;

  -- O pedido pago vira desta conta. `barbearia_id is null` garante que um
  -- pagamento abre uma conta só, mesmo com dois cadastros no mesmo segundo.
  if v_pedido ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    begin
      update public.pedidos
         set barbearia_id = new.id
       where id = v_pedido::uuid
         and barbearia_id is null
         and situacao = 'pago';
      perform public.recalcular_pagamento(new.id);
    exception
      when others then
        raise warning '[BARBOS] pedido % não vinculado: %', v_pedido, sqlerrm;
    end;
  end if;

  return new;
end $$;

comment on function public.ao_criar_usuario() is
  'Conta nova ganha barbearia (com slug) e configuração de agenda; o pedido pago do cadastro a libera — 0021, 0041.';

-- ============================================================
-- As barbearias de hoje: liberadas, como pedido "manual"
-- ============================================================

insert into public.pedidos (plano, situacao, barbearia_id, pago_em, observacao)
select 'manual', 'pago', b.id, now(), 'já usava o sistema antes do pagamento (0041)'
from public.barbearias b
where not exists (select 1 from public.pedidos p where p.barbearia_id = b.id);

select public.recalcular_pagamentos();

-- ============================================================
-- O agendador: todo dia, 00h15 no horário da barbearia (03h15 UTC)
-- ============================================================

create extension if not exists pg_cron;

select cron.schedule(
  'barbos-recalcular-pagamentos',
  '15 3 * * *',
  $$select public.recalcular_pagamentos()$$
);

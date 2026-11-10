-- ============================================================
-- BARBOS — migração 0044: painel admin e notificações do sistema
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0040 (as views do caixa) e 0041 (pedidos). Pode rodar mais
-- de uma vez.
--
-- Compatível com o código que está no ar: só acrescenta (uma coluna com
-- padrão, duas tabelas e funções novas). Migração primeiro, deploy depois.
--
-- ============================================================
-- O QUE ENTRA
-- ============================================================
--
-- 1. `barbearias.admin`. Abre o Painel Admin. Pedido do Gabriel em
--    10/11/2026: só a barbearia BARBOS pode ter `admin = true`.
--    Três travas, e nenhuma depende da tela:
--      - índice único parcial: no máximo UMA conta admin no banco inteiro;
--      - gatilho `proteger_admin`: a API (anon/authenticated) nunca liga
--        nem desliga a coluna. A política "edita a propria barbearia"
--        deixa a dona mudar a própria linha, igual ao `pagamento_ativo`
--        da 0041, e sem o gatilho qualquer conta virava admin com um
--        update de uma linha;
--      - só o SQL Editor (postgres) muda quem é admin.
--    Quem nasce admin é a barbearia de apelido BARBOS, aqui embaixo.
--
-- 2. Funções do painel (`admin_*`). Todas `security definer` e todas
--    começam por `sou_admin()`: quem não é admin recebe erro 42501, nunca
--    uma lista vazia que pareceria "não tem nada". O painel enxerga SOMAS
--    por barbearia, nunca as linhas de agendamento ou de venda.
--
--    A regra do que conta é a do dashboard, lida das MESMAS views:
--    serviço por `servicos_no_caixa`, loja por `vendas_no_caixa` (0026,
--    0040). Nada de regra copiada: o número do painel para uma barbearia
--    é o número que ela vê no dashboard dela, sem filtro.
--
-- 3. Notificações do sistema: `comunicados` e `comunicados_lidos`.
--    Na tela o nome é "Notificações"; no banco é `comunicados` porque
--    `lib/notificacoes/` e o "aviso de agendamento" (0035) já são outra
--    coisa — a notificação no celular quando um cliente marca horário.
--    Todas as barbearias leem; só o admin escreve.
-- ============================================================

-- ---------- 1. a coluna admin ----------
alter table public.barbearias
  add column if not exists admin boolean not null default false;

comment on column public.barbearias.admin is
  'Abre o Painel Admin. No máximo uma conta; só o SQL Editor muda — 0044.';

create unique index if not exists barbearias_um_admin
  on public.barbearias ((admin))
  where admin;

create or replace function public.proteger_admin()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' then
      new.admin := false;
    elsif new.admin is distinct from old.admin then
      new.admin := old.admin;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists proteger_admin on public.barbearias;
create trigger proteger_admin
  before insert or update of admin on public.barbearias
  for each row execute function public.proteger_admin();

-- A BARBOS nasce admin. O `not exists` deixa a migração rodar de novo sem
-- brigar com o índice único caso o admin tenha sido trocado à mão depois.
update public.barbearias
   set admin = true
 where slug = 'BARBOS'
   and not admin
   and not exists (select 1 from public.barbearias where admin);

-- A conta logada é a admin? Lida pelas políticas e pelas funções abaixo.
create or replace function public.sou_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select b.admin from public.barbearias b where b.id = auth.uid()),
    false
  )
$$;

-- ---------- 2. funções do painel ----------

-- Todas as barbearias, com o pagamento de cada uma.
--
-- `situacao` é o resumo para a tela, calculado aqui para a regra dos 7
-- dias de tolerância não ser reescrita no TypeScript:
--   bloqueada   pagamento_ativo = false (o proxy já manda para /assinatura)
--   liberada    plano manual, sem vencimento
--   tolerancia  mensalidade vencida, dentro dos 7 dias
--   em_dia      o resto
-- `vale_ate` é o último dia com acesso: mensal = vencimento + 7.
create or replace function public.admin_barbearias()
returns table (
  id               uuid,
  nome             text,
  slug             text,
  telefone         text,
  email            text,
  criada_em        timestamptz,
  ultimo_acesso    timestamptz,
  admin            boolean,
  pagamento_ativo  boolean,
  plano            text,
  acesso_ate       date,
  vale_ate         date,
  atrasado_desde   timestamptz,
  situacao         text
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.sou_admin() then
    raise exception 'só a conta admin' using errcode = '42501';
  end if;

  return query
  select
    b.id,
    b.nome,
    b.slug,
    b.telefone,
    u.email::text,
    b.criada_em,
    u.last_sign_in_at,
    b.admin,
    b.pagamento_ativo,
    p.plano,
    p.acesso_ate,
    case when p.plano = 'mensal' then p.acesso_ate + 7 else p.acesso_ate end,
    p.atrasado_desde,
    case
      when not b.pagamento_ativo then 'bloqueada'
      when p.plano = 'manual' then 'liberada'
      when p.plano = 'mensal' and p.acesso_ate < public.hoje_na_barbearia() then 'tolerancia'
      else 'em_dia'
    end
  from public.barbearias b
  left join auth.users u on u.id = b.id
  -- O mesmo pedido que a `minha_assinatura` (0041) mostra para a dona:
  -- o pago primeiro, e entre iguais o mais recente.
  left join lateral (
    select pe.plano, pe.acesso_ate, pe.atrasado_desde
    from public.pedidos pe
    where pe.barbearia_id = b.id
      and pe.situacao <> 'aguardando'
    order by (pe.situacao = 'pago') desc, coalesce(pe.pago_em, pe.criado_em) desc
    limit 1
  ) p on true
  order by b.criada_em;
end $$;

-- As somas de cada barbearia num período. `p_fim` é exclusivo, o mesmo
-- contrato da `resumo_dashboard`.
--
--   agendamentos  marcados com data no período, sem os cancelados
--   atendimentos  serviços que entraram no caixa (agenda + registro manual)
--   servico_centavos / vendas / loja_centavos  as views do caixa
--
-- Devolve uma linha por barbearia, inclusive as zeradas: barbearia
-- parada é informação, e sumir da lista esconderia justamente ela.
create or replace function public.admin_movimento(p_inicio date, p_fim date)
returns table (
  barbearia_id      uuid,
  agendamentos      integer,
  atendimentos      integer,
  servico_centavos  bigint,
  vendas            integer,
  loja_centavos     bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.sou_admin() then
    raise exception 'só a conta admin' using errcode = '42501';
  end if;
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'período inválido' using errcode = '22023';
  end if;

  return query
  select
    b.id,
    coalesce(ag.qtd, 0)::integer,
    coalesce(sv.qtd, 0)::integer,
    coalesce(sv.total, 0)::bigint,
    coalesce(vd.qtd, 0)::integer,
    coalesce(vd.total, 0)::bigint
  from public.barbearias b
  left join (
    select a.barbearia_id as dono, count(*) as qtd
    from public.agendamentos a
    where a.data >= p_inicio and a.data < p_fim
      and a.estado <> 'cancelado'
    group by a.barbearia_id
  ) ag on ag.dono = b.id
  left join (
    select s.barbearia_id as dono, count(*) as qtd, sum(s.preco_centavos) as total
    from public.servicos_no_caixa s
    where s.data >= p_inicio and s.data < p_fim
    group by s.barbearia_id
  ) sv on sv.dono = b.id
  left join (
    select v.barbearia_id as dono, count(*) as qtd, sum(v.total_centavos) as total
    from public.vendas_no_caixa v
    where v.data_caixa >= p_inicio and v.data_caixa < p_fim
    group by v.barbearia_id
  ) vd on vd.dono = b.id;
end $$;

-- ---------- 3. notificações do sistema ----------
create table if not exists public.comunicados (
  id             uuid primary key default gen_random_uuid(),
  -- atualizacao: nota de versão, recurso novo.
  -- alerta: sistema fora do ar, instabilidade, manutenção — vira faixa no
  -- topo de todas as telas até a barbearia ler.
  tipo           text not null check (tipo in ('atualizacao', 'alerta')),
  titulo         text not null check (char_length(btrim(titulo)) between 1 and 120),
  texto          text not null check (char_length(btrim(texto)) between 1 and 5000),
  publicado_em   timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.comunicados is
  'Notificações do BARBOS para todas as barbearias (atualizações e alertas). Só o admin escreve — 0044.';

create index if not exists comunicados_publicado on public.comunicados (publicado_em desc);

drop trigger if exists tocar_comunicados on public.comunicados;
create trigger tocar_comunicados
  before update on public.comunicados
  for each row execute function public.tocar_atualizado_em();

create table if not exists public.comunicados_lidos (
  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,
  comunicado_id  uuid not null
                   references public.comunicados(id) on delete cascade,
  lido_em        timestamptz not null default now(),
  primary key (barbearia_id, comunicado_id)
);

create index if not exists comunicados_lidos_por_comunicado
  on public.comunicados_lidos (comunicado_id);

alter table public.comunicados enable row level security;
alter table public.comunicados_lidos enable row level security;

drop policy if exists "toda barbearia le" on public.comunicados;
create policy "toda barbearia le" on public.comunicados
  for select to authenticated
  using (true);

drop policy if exists "so o admin publica" on public.comunicados;
create policy "so o admin publica" on public.comunicados
  for insert to authenticated
  with check (public.sou_admin());

drop policy if exists "so o admin edita" on public.comunicados;
create policy "so o admin edita" on public.comunicados
  for update to authenticated
  using (public.sou_admin())
  with check (public.sou_admin());

drop policy if exists "so o admin apaga" on public.comunicados;
create policy "so o admin apaga" on public.comunicados
  for delete to authenticated
  using (public.sou_admin());

drop policy if exists "a propria leitura" on public.comunicados_lidos;
create policy "a propria leitura" on public.comunicados_lidos
  for select to authenticated
  using (barbearia_id = auth.uid());

drop policy if exists "marca a propria leitura" on public.comunicados_lidos;
create policy "marca a propria leitura" on public.comunicados_lidos
  for insert to authenticated
  with check (barbearia_id = auth.uid());

-- O Supabase dá tudo (inclusive TRUNCATE, que passa por cima do RLS) para
-- anon e authenticated em tabela nova. Aqui fica só o que a tela usa.
revoke all on public.comunicados, public.comunicados_lidos from anon, authenticated;
grant select, insert, update, delete on public.comunicados to authenticated;
grant select, insert on public.comunicados_lidos to authenticated;

-- As notificações da conta logada, da mais nova para a mais antiga.
--
-- `nova` = não lida E publicada depois que a barbearia foi criada. Sem a
-- segunda parte, quem assina hoje entraria com o sino marcando todas as
-- notas de versão do ano. O admin não recebe as próprias: nunca `nova`.
create or replace function public.meus_comunicados()
returns table (
  id             uuid,
  tipo           text,
  titulo         text,
  texto          text,
  publicado_em   timestamptz,
  atualizado_em  timestamptz,
  nova           boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.tipo,
    c.titulo,
    c.texto,
    c.publicado_em,
    c.atualizado_em,
    not public.sou_admin()
      and c.publicado_em >= coalesce(
        (select b.criada_em from public.barbearias b where b.id = auth.uid()),
        'infinity'::timestamptz
      )
      and not exists (
        select 1 from public.comunicados_lidos l
        where l.comunicado_id = c.id and l.barbearia_id = auth.uid()
      )
  from public.comunicados c
  order by c.publicado_em desc
  limit 200
$$;

-- O sino e a faixa: quantas novas, e o alerta novo mais recente.
create or replace function public.comunicados_nao_lidos()
returns table (quantidade integer, alerta_id uuid, alerta_titulo text)
language sql
stable
security invoker
set search_path = public
as $$
  select
    count(*)::integer,
    (array_agg(m.id order by m.publicado_em desc) filter (where m.tipo = 'alerta'))[1],
    (array_agg(m.titulo order by m.publicado_em desc) filter (where m.tipo = 'alerta'))[1]
  from public.meus_comunicados() m
  where m.nova
$$;

-- Marca como lidas. Sem lista = todas (abrir a tela de notificações).
create or replace function public.marcar_comunicados_lidos(p_ids uuid[] default null)
returns integer
language sql
volatile
security invoker
set search_path = public
as $$
  with novas as (
    insert into public.comunicados_lidos (barbearia_id, comunicado_id)
    select auth.uid(), c.id
    from public.comunicados c
    where auth.uid() is not null
      and (p_ids is null or c.id = any (p_ids))
    on conflict do nothing
    returning 1
  )
  select count(*)::integer from novas
$$;

-- A lista do admin, com quantas barbearias leram cada uma.
--
-- `publico` = barbearias (fora a admin) que já existiam na publicação; é
-- para elas que a notificação foi "nova". `lidos` conta só essas.
create or replace function public.admin_comunicados()
returns table (
  id             uuid,
  tipo           text,
  titulo         text,
  texto          text,
  publicado_em   timestamptz,
  atualizado_em  timestamptz,
  lidos          integer,
  publico        integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.sou_admin() then
    raise exception 'só a conta admin' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.tipo,
    c.titulo,
    c.texto,
    c.publicado_em,
    c.atualizado_em,
    (select count(*)
       from public.comunicados_lidos l
       join public.barbearias b on b.id = l.barbearia_id
      where l.comunicado_id = c.id
        and not b.admin
        and b.criada_em <= c.publicado_em)::integer,
    (select count(*)
       from public.barbearias b
      where not b.admin
        and b.criada_em <= c.publicado_em)::integer
  from public.comunicados c
  order by c.publicado_em desc;
end $$;

-- ---------- quem pode chamar o quê ----------
-- O Supabase dá EXECUTE de toda função nova para anon. Nenhuma destas é
-- de quem não entrou.
revoke execute on function
  public.proteger_admin(),
  public.sou_admin(),
  public.admin_barbearias(),
  public.admin_movimento(date, date),
  public.admin_comunicados(),
  public.meus_comunicados(),
  public.comunicados_nao_lidos(),
  public.marcar_comunicados_lidos(uuid[])
from public, anon;

revoke execute on function public.proteger_admin() from authenticated;

grant execute on function
  public.sou_admin(),
  public.admin_barbearias(),
  public.admin_movimento(date, date),
  public.admin_comunicados(),
  public.meus_comunicados(),
  public.comunicados_nao_lidos(),
  public.marcar_comunicados_lidos(uuid[])
to authenticated;

notify pgrst, 'reload schema';

-- ============================================================
-- BARBOS — migração 0033: convites de agendamento
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0014, 0018, 0019, 0020, 0031 e 0032.
-- Pode rodar mais de uma vez.
--
-- Links de agendamento com validade e com limite, no formato do convite
-- de servidor do Discord: a barbearia gera quantos quiser, cada um com
-- a sua regra, e desliga o que não quer mais.
--
-- ============================================================
-- DUAS COISAS QUE ESTA MIGRAÇÃO **NÃO** FAZ
-- ============================================================
--
-- 1. NÃO encosta em `agenda_publica` nem em `criar_agendamento_publico`.
--    Elas continuam exatamente como estavam — é a produção que as chama
--    agora, com gente de verdade marcando horário. As funções novas aqui
--    têm NOMES NOVOS e CHAMAM as antigas em vez de copiá-las, para que
--    não exista uma segunda cópia das regras de expediente, de grade e
--    de folga esperando divergir no primeiro ajuste.
--
-- 2. NÃO tira o link do apelido (`/agendar/bicos`). Ele continua aberto
--    para sempre, sem validade e sem limite: já tem QR code impresso e
--    link mandado no WhatsApp apontando para lá, e um convite expirado
--    não é motivo para quebrar o que está colado na parede.
--
-- Por isso toda resolução aqui começa pelo APELIDO. Só quando a chave
-- não é apelido de ninguém é que ela é tratada como código de convite.
--
-- ============================================================
-- O QUE CONTA COMO "USO"
-- ============================================================
--
-- Um agendamento MARCADO — não uma visita à página. O WhatsApp abre o
-- link sozinho para montar a prévia, e contar visitas gastaria o convite
-- sem ninguém ter clicado. Abrir e desistir não gasta nada.
--
-- Uso não volta quando o agendamento é cancelado ou excluído. O convite
-- mede quantas vezes ele foi usado, não quantas pessoas apareceram.
-- ============================================================

create table if not exists public.convites_agendamento (
  id            uuid primary key default gen_random_uuid(),

  barbearia_id  uuid not null default auth.uid()
                  references public.barbearias(id) on delete cascade,

  -- Curto e opaco, como o do Discord. Sem vogais e sem 0/1/l/o: o código
  -- vai ser ditado no balcão e digitado errado se tiver ambiguidade.
  codigo        text not null unique,

  -- null = não expira.
  expira_em     timestamptz,
  -- null = ilimitado.
  usos_max      smallint,
  usos          integer not null default 0,

  -- Desligado pela dona. Separado de apagar: o link some de circulação
  -- mas a linha fica, e "esse link foi desativado" é uma resposta melhor
  -- do que "link não encontrado" para quem recebeu o papel semana passada.
  revogado      boolean not null default false,

  criado_em     timestamptz not null default now(),

  constraint usos_max_valido check (usos_max is null or usos_max > 0)
);

comment on table public.convites_agendamento is
  'Links de agendamento com validade e/ou limite de uso. O link do apelido continua aberto em paralelo.';

create index if not exists convites_da_barbearia_idx
  on public.convites_agendamento (barbearia_id, criado_em desc);

alter table public.convites_agendamento enable row level security;

drop policy if exists "convites da propria barbearia" on public.convites_agendamento;
create policy "convites da propria barbearia" on public.convites_agendamento
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ------------------------------------------------------------
-- gerar_codigo_convite — oito caracteres sem ambiguidade
--
-- `security definer` de propósito: o sorteio precisa enxergar os códigos
-- de TODAS as barbearias para não repetir. Sob o RLS ele só veria os da
-- própria conta, acharia que está livre, e o `unique` recusaria a linha
-- com um erro que não diz nada.
--
-- Também evita colidir com apelido de barbearia: a rota pública resolve
-- apelido primeiro, e um código igual a um apelido existente nunca seria
-- alcançado.
-- ------------------------------------------------------------

create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  -- Sem a, e, i, o, u (não forma palavra sem querer) e sem 0, 1, l:
  -- este código vai ser ditado em voz alta no balcão.
  v_alfabeto constant text := 'bcdfghjkmnpqrstvwxyz23456789';
  v_codigo   text;
  v_i        int;
begin
  loop
    v_codigo := '';
    for v_i in 1..8 loop
      v_codigo := v_codigo ||
        substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.convites_agendamento c where c.codigo = v_codigo
    ) and not exists (
      select 1 from public.barbearias b where b.slug = v_codigo
    );
  end loop;

  return v_codigo;
end $$;

-- Depois da função, porque o default a invoca.
alter table public.convites_agendamento
  alter column codigo set default public.gerar_codigo_convite();

revoke all on function public.gerar_codigo_convite() from public;
grant execute on function public.gerar_codigo_convite() to authenticated;

-- ------------------------------------------------------------
-- agenda_publica_por_chave — apelido OU código
--
-- Devolve o MESMO corpo de `agenda_publica`, com um `convite` a mais.
-- Quando a chave é apelido, `convite` vem nulo e nada muda.
--
-- Convite inválido não é 404: cada motivo tem a sua frase, porque quem
-- abre um link vencido precisa saber se pede outro à barbearia (expirado,
-- esgotado) ou se digitou errado (não encontrado).
-- ------------------------------------------------------------

create or replace function public.agenda_publica_por_chave(
  p_chave text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_slug text;
  v_c    record;
begin
  -- APELIDO PRIMEIRO. O link permanente nunca deixa de valer, e resolver
  -- nesta ordem é o que garante isso mesmo se um código sorteado um dia
  -- coincidir com um apelido novo.
  select b.slug into v_slug
  from public.barbearias b
  where b.slug = p_chave
  limit 1;

  if v_slug is not null then
    return public.agenda_publica(v_slug, p_data)
           || jsonb_build_object('convite', null);
  end if;

  select c.id, c.codigo, c.expira_em, c.usos, c.usos_max, c.revogado,
         b.slug as slug
  into v_c
  from public.convites_agendamento c
  join public.barbearias b on b.id = c.barbearia_id
  where c.codigo = p_chave;

  if v_c.id is null then
    return jsonb_build_object(
      'ok', false, 'motivo', 'nao-encontrado',
      'erro', 'Esse link não existe. Confira o endereço com a barbearia.');
  end if;

  if v_c.revogado then
    return jsonb_build_object(
      'ok', false, 'motivo', 'revogado',
      'erro', 'A barbearia desativou esse link. Peça o link novo a ela.');
  end if;

  if v_c.expira_em is not null and now() >= v_c.expira_em then
    return jsonb_build_object(
      'ok', false, 'motivo', 'expirado',
      'erro', 'Esse link expirou. Peça o link novo à barbearia.');
  end if;

  if v_c.usos_max is not null and v_c.usos >= v_c.usos_max then
    return jsonb_build_object(
      'ok', false, 'motivo', 'esgotado',
      'erro', 'Esse link já atingiu o limite de agendamentos. Peça o link novo à barbearia.');
  end if;

  return public.agenda_publica(v_c.slug, p_data)
         || jsonb_build_object('convite', jsonb_build_object(
              'codigo',   v_c.codigo,
              'expiraEm', v_c.expira_em,
              'usos',     v_c.usos,
              'usosMax',  v_c.usos_max));
end $$;

comment on function public.agenda_publica_por_chave is
  'Agenda publica por apelido OU por codigo de convite. Apelido primeiro.';

revoke all on function public.agenda_publica_por_chave(text, date) from public;
grant execute on function public.agenda_publica_por_chave(text, date)
  to anon, authenticated;

-- ------------------------------------------------------------
-- criar_agendamento_publico_por_chave
--
-- Mesma ideia: apelido cai direto na função antiga; código passa pelo
-- convite primeiro.
--
-- `for update of c` trava a LINHA DO CONVITE até o fim da transação. É o
-- que faz um convite de 1 uso aguentar duas pessoas tocando em confirmar
-- no mesmo segundo: a segunda espera a primeira terminar e então lê o
-- contador já atualizado. Sem a trava, as duas leriam `usos = 0` e as
-- duas entrariam.
--
-- O contador sobe DEPOIS do agendamento gravar, e só se gravar. Recusa
-- por horário ocupado não pode queimar um uso — quem levou "esse horário
-- acabou de ser ocupado" não marcou nada.
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico_por_chave(
  p_chave text,
  p_cliente_nome text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_horario time,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_slug text;
  v_c    record;
  v_r    jsonb;
begin
  select b.slug into v_slug
  from public.barbearias b
  where b.slug = p_chave
  limit 1;

  if v_slug is not null then
    return public.criar_agendamento_publico(
      v_slug, p_cliente_nome, p_barbeiro_id, p_servico_id,
      p_data, p_horario, p_observacao);
  end if;

  select c.id, c.codigo, c.expira_em, c.usos, c.usos_max, c.revogado,
         b.slug as slug
  into v_c
  from public.convites_agendamento c
  join public.barbearias b on b.id = c.barbearia_id
  where c.codigo = p_chave
  for update of c;

  if v_c.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esse link não existe.');
  end if;

  if v_c.revogado then
    return jsonb_build_object('ok', false,
      'erro', 'A barbearia desativou esse link. Peça o link novo a ela.');
  end if;

  if v_c.expira_em is not null and now() >= v_c.expira_em then
    return jsonb_build_object('ok', false,
      'erro', 'Esse link expirou. Peça o link novo à barbearia.');
  end if;

  if v_c.usos_max is not null and v_c.usos >= v_c.usos_max then
    return jsonb_build_object('ok', false,
      'erro', 'Esse link já atingiu o limite de agendamentos.');
  end if;

  v_r := public.criar_agendamento_publico(
    v_c.slug, p_cliente_nome, p_barbeiro_id, p_servico_id,
    p_data, p_horario, p_observacao);

  if coalesce((v_r->>'ok')::boolean, false) then
    update public.convites_agendamento
       set usos = usos + 1
     where id = v_c.id;

    v_r := v_r || jsonb_build_object(
      'usos', v_c.usos + 1, 'usosMax', v_c.usos_max);
  end if;

  return v_r;
end $$;

comment on function public.criar_agendamento_publico_por_chave is
  'Marca pelo link publico, por apelido ou por codigo de convite. So conta uso quando grava.';

revoke all on function public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text) from public;
grant execute on function public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text) to anon, authenticated;

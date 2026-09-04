-- ============================================================
-- BARBOS — migração 0002: agendamentos
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001_barbearias.sql. Pode rodar mais de uma vez sem quebrar.
--
-- Uma linha por horário marcado: quem, qual serviço, que dia, que hora.
-- ============================================================

-- ---------- serviços da barbearia ----------
-- Enum e não tabela: hoje a barbearia tem um cardápio fixo. Quando o dono
-- precisar criar serviço próprio, isto vira tabela `servicos` e a coluna
-- abaixo vira chave estrangeira.
do $$
begin
  create type public.servico_barbearia as enum ('cabelo', 'barba', 'cabelo_barba');
exception
  when duplicate_object then null;
end $$;

-- ---------- estado do agendamento ----------
do $$
begin
  create type public.estado_agendamento as enum (
    'agendado', 'confirmado', 'atendendo', 'concluido', 'faltou', 'cancelado'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.agendamentos (
  id             uuid primary key default gen_random_uuid(),

  -- Dono da linha. O default deixa o INSERT do app enxuto, e o RLS abaixo
  -- garante que ninguém escreva na barbearia de outro.
  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,

  cliente_nome   text not null check (length(trim(cliente_nome)) > 0),
  servico        public.servico_barbearia not null,

  -- Data e hora separadas, e não um timestamptz: a barbearia atende num
  -- endereço só, e o que vale é o relógio da parede. Guardar com fuso faria
  -- "14:00" virar outra coisa no horário de verão ou em outro servidor.
  data           date not null,
  horario        time not null,

  estado         public.estado_agendamento not null default 'agendado',
  observacao     text,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  -- Dois clientes no mesmo minuto é quase sempre erro de digitação.
  -- Cancelado não conta: o horário volta a ficar livre.
  constraint agendamento_sem_choque unique (barbearia_id, data, horario)
);

comment on table public.agendamentos is
  'Um horário marcado. data+horario são hora local da barbearia, sem fuso.';

-- A consulta mais quente do sistema: o mês visível no calendário.
create index if not exists agendamentos_barbearia_data_idx
  on public.agendamentos (barbearia_id, data, horario);

-- ---------- atualizado_em sempre verdadeiro ----------
-- Função própria: a de 0001 escreve em `atualizada_em` (nome da coluna lá).
-- Reaproveitá-la aqui quebraria todo UPDATE, porque essa coluna não existe
-- nesta tabela — plpgsql não resolve nome de campo em tempo de execução.
create or replace function public.tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end $$;

drop trigger if exists tocar_agendamentos on public.agendamentos;
create trigger tocar_agendamentos
  before update on public.agendamentos
  for each row execute function public.tocar_atualizado_em();

-- ============================================================
-- RLS — cada barbearia só enxerga a própria agenda
--
-- barbearias.id É o auth.users.id, então a comparação é direta.
-- ============================================================

alter table public.agendamentos enable row level security;

drop policy if exists "agenda da propria barbearia" on public.agendamentos;
create policy "agenda da propria barbearia" on public.agendamentos
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

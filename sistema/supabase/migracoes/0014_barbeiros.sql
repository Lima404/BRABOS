-- ============================================================
-- BARBOS — migração 0014: barbeiros (equipe da barbearia)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001. Pode rodar mais de uma vez sem quebrar.
--
-- MODELO: barbeiro é LINHA dentro da barbearia, não conta Auth.
-- Entram com o login da dona. Agenda e dashboard por barbeiro
-- usam esta tabela depois; aqui só o cadastro da equipe.
-- ============================================================

create table if not exists public.barbeiros (
  id             uuid primary key default gen_random_uuid(),

  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,

  nome           text not null check (length(trim(nome)) > 0),
  telefone       text not null check (length(trim(telefone)) > 0),

  -- Soft-delete: some da lista sem apagar histórico futuro de agenda.
  ativo          boolean not null default true,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.barbeiros is
  'Equipe da barbearia. Sem Auth — só nome e telefone ligados à conta.';

create index if not exists barbeiros_barbearia_nome_idx
  on public.barbeiros (barbearia_id, nome)
  where ativo;

drop trigger if exists tocar_barbeiros on public.barbeiros;
create trigger tocar_barbeiros
  before update on public.barbeiros
  for each row execute function public.tocar_atualizado_em();

alter table public.barbeiros enable row level security;

drop policy if exists "barbeiros da propria barbearia" on public.barbeiros;
create policy "barbeiros da propria barbearia" on public.barbeiros
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

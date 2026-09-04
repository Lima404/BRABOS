-- ============================================================
-- BARBOS — migração 0001: contas
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Pode rodar mais de uma vez sem quebrar.
--
-- MODELO: uma conta de login = uma barbearia.
-- Por isso `barbearias.id` É o id do usuário em auth.users — não há tabela
-- de perfil no meio. Um registro, uma dona, um login.
--
-- Os barbeiros da equipe virão depois como LINHAS dentro da barbearia, e
-- entram no sistema com o e-mail e a senha da barbearia (login compartilhado).
-- Eles não são usuários do Supabase Auth.
-- ============================================================

create table if not exists public.barbearias (
  -- Sem default: o id vem de auth.users. Conta apagada, barbearia junto.
  id             uuid primary key references auth.users(id) on delete cascade,
  nome           text not null default 'Minha barbearia'
                   check (length(trim(nome)) > 0),
  telefone       text,
  criada_em      timestamptz not null default now(),
  atualizada_em  timestamptz not null default now()
);

comment on table public.barbearias is
  'Uma linha por conta de login. O id é o mesmo de auth.users.';

-- ---------- atualizada_em sempre verdadeiro ----------
create or replace function public.tocar_atualizada_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizada_em := now();
  return new;
end $$;

drop trigger if exists tocar_barbearias on public.barbearias;
create trigger tocar_barbearias
  before update on public.barbearias
  for each row execute function public.tocar_atualizada_em();

-- ============================================================
-- RLS — cada conta enxerga só a si mesma
--
-- Como o id da barbearia É o id do usuário, a política é uma comparação
-- direta com auth.uid(): sem função auxiliar, sem risco de recursão.
-- ============================================================

alter table public.barbearias enable row level security;

drop policy if exists "ve a propria barbearia" on public.barbearias;
create policy "ve a propria barbearia" on public.barbearias
  for select using (id = auth.uid());

drop policy if exists "edita a propria barbearia" on public.barbearias;
create policy "edita a propria barbearia" on public.barbearias
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Sem policy de INSERT nem DELETE de propósito: quem cria é o trigger de
-- cadastro (abaixo), e apagar a conta é operação de painel, não de aplicação.

-- ============================================================
-- Cadastro: todo usuário novo nasce com sua barbearia
-- ============================================================

create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.barbearias (id, nome)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data->>'barbearia'), ''),
      'Minha barbearia'
    )
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

-- ============================================================
-- Usuários que já existiam antes desta migração
-- ============================================================

insert into public.barbearias (id, nome)
select
  u.id,
  coalesce(
    nullif(trim(u.raw_user_meta_data->>'barbearia'), ''),
    'Minha barbearia'
  )
from auth.users u
on conflict (id) do nothing;

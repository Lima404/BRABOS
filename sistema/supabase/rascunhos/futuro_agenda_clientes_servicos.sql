-- ============================================================
-- BARBOS — esquema inicial
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
--
-- Modelo: uma conta = um dono = uma barbearia. Toda tabela carrega
-- barbearia_id, e o RLS garante que ninguem enxerga a barbearia do outro.
-- Isso e o que impede o vazamento de dados entre clientes — nao e opcional.
-- ============================================================

-- ---------- barbearias ----------
create table if not exists public.barbearias (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null check (length(trim(nome)) > 0),
  telefone    text,
  criada_em   timestamptz not null default now()
);

-- ---------- perfis (1:1 com auth.users) ----------
create table if not exists public.perfis (
  id            uuid primary key references auth.users(id) on delete cascade,
  barbearia_id  uuid not null references public.barbearias(id) on delete cascade,
  nome          text not null default '',
  criado_em     timestamptz not null default now()
);

create index if not exists perfis_barbearia_idx on public.perfis(barbearia_id);

-- Helper: a barbearia do usuario logado.
-- SECURITY DEFINER pra nao cair em recursao de RLS ao ser usada nas policies.
create or replace function public.minha_barbearia()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select barbearia_id from public.perfis where id = auth.uid();
$$;

-- ---------- clientes ----------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references public.barbearias(id) on delete cascade,
  nome          text not null check (length(trim(nome)) > 0),
  telefone      text,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create index if not exists clientes_barbearia_idx on public.clientes(barbearia_id);

-- ---------- servicos ----------
create table if not exists public.servicos (
  id              uuid primary key default gen_random_uuid(),
  barbearia_id    uuid not null references public.barbearias(id) on delete cascade,
  nome            text not null check (length(trim(nome)) > 0),
  -- Dinheiro em centavos, inteiro. Nunca float.
  preco_centavos  integer not null check (preco_centavos >= 0),
  duracao_min     integer not null check (duracao_min > 0),
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now()
);

create index if not exists servicos_barbearia_idx on public.servicos(barbearia_id);

-- ---------- produtos (estoque) ----------
create table if not exists public.produtos (
  id              uuid primary key default gen_random_uuid(),
  barbearia_id    uuid not null references public.barbearias(id) on delete cascade,
  nome            text not null check (length(trim(nome)) > 0),
  quantidade      integer not null default 0 check (quantidade >= 0),
  quantidade_min  integer not null default 0 check (quantidade_min >= 0),
  preco_centavos  integer check (preco_centavos >= 0),
  criado_em       timestamptz not null default now()
);

create index if not exists produtos_barbearia_idx on public.produtos(barbearia_id);

-- ---------- agendamentos ----------
-- create type nao aceita "if not exists": envolvido pra migracao poder
-- rodar de novo sem quebrar.
do $$
begin
  create type public.estado_agendamento as enum (
    'agendado', 'confirmado', 'atendendo', 'concluido', 'faltou', 'cancelado'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.agendamentos (
  id            uuid primary key default gen_random_uuid(),
  barbearia_id  uuid not null references public.barbearias(id) on delete cascade,
  cliente_id    uuid references public.clientes(id) on delete set null,
  -- Guardado quando nao ha cadastro ("Cliente sem cadastro" na agenda).
  cliente_nome  text,
  inicio        timestamptz not null,
  duracao_min   integer not null check (duracao_min > 0),
  estado        public.estado_agendamento not null default 'agendado',
  observacao    text,
  criado_em     timestamptz not null default now(),
  -- Ou tem cliente cadastrado, ou tem nome escrito. Nunca nenhum dos dois.
  constraint agendamento_tem_cliente
    check (cliente_id is not null or length(trim(coalesce(cliente_nome, ''))) > 0)
);

-- A consulta mais quente do sistema: agenda de um dia, em ordem de horario.
create index if not exists agendamentos_barbearia_inicio_idx
  on public.agendamentos(barbearia_id, inicio);

-- ---------- servicos de cada agendamento ----------
-- Preco copiado no momento do agendamento: se o corte subir de preco amanha,
-- o historico de ontem nao pode mudar.
create table if not exists public.agendamento_servicos (
  agendamento_id  uuid not null references public.agendamentos(id) on delete cascade,
  servico_id      uuid references public.servicos(id) on delete set null,
  nome            text not null,
  preco_centavos  integer not null check (preco_centavos >= 0),
  primary key (agendamento_id, nome)
);

-- ============================================================
-- RLS — ninguem ve a barbearia do vizinho
-- ============================================================

alter table public.barbearias            enable row level security;
alter table public.perfis                enable row level security;
alter table public.clientes              enable row level security;
alter table public.servicos              enable row level security;
alter table public.produtos              enable row level security;
alter table public.agendamentos          enable row level security;
alter table public.agendamento_servicos  enable row level security;

-- barbearias: so a sua
drop policy if exists "ve a propria barbearia" on public.barbearias;
create policy "ve a propria barbearia" on public.barbearias
  for select using (id = public.minha_barbearia());

drop policy if exists "edita a propria barbearia" on public.barbearias;
create policy "edita a propria barbearia" on public.barbearias
  for update using (id = public.minha_barbearia());

-- perfis: so o seu
drop policy if exists "ve o proprio perfil" on public.perfis;
create policy "ve o proprio perfil" on public.perfis
  for select using (id = auth.uid());

drop policy if exists "edita o proprio perfil" on public.perfis;
create policy "edita o proprio perfil" on public.perfis
  for update using (id = auth.uid());

-- Tabelas comuns: uma policy por tabela, cobrindo tudo.
do $$
declare t text;
begin
  foreach t in array array['clientes', 'servicos', 'produtos', 'agendamentos']
  loop
    execute format('drop policy if exists "isolamento por barbearia" on public.%I', t);
    execute format($f$
      create policy "isolamento por barbearia" on public.%I
        for all
        using (barbearia_id = public.minha_barbearia())
        with check (barbearia_id = public.minha_barbearia())
    $f$, t);
  end loop;
end $$;

-- Servicos do agendamento: herdam o isolamento do agendamento pai.
drop policy if exists "isolamento via agendamento" on public.agendamento_servicos;
create policy "isolamento via agendamento" on public.agendamento_servicos
  for all
  using (
    exists (
      select 1 from public.agendamentos a
      where a.id = agendamento_id and a.barbearia_id = public.minha_barbearia()
    )
  )
  with check (
    exists (
      select 1 from public.agendamentos a
      where a.id = agendamento_id and a.barbearia_id = public.minha_barbearia()
    )
  );

-- ============================================================
-- Cadastro: todo usuario novo ganha barbearia e perfil
-- ============================================================

create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_barbearia uuid;
begin
  insert into public.barbearias (nome)
  values (coalesce(nullif(trim(new.raw_user_meta_data->>'barbearia'), ''), 'Minha barbearia'))
  returning id into nova_barbearia;

  insert into public.perfis (id, barbearia_id, nome)
  values (
    new.id,
    nova_barbearia,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'), ''), split_part(new.email, '@', 1))
  );

  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

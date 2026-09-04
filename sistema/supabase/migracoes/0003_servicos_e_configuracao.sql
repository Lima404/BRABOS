-- ============================================================
-- BARBOS — migração 0003: serviços e configuração da agenda
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001 e 0002. Pode rodar mais de uma vez sem quebrar.
--
-- O que muda aqui:
--   1. `servicos`             — o cardápio deixa de ser enum e vira tabela.
--   2. `configuracao_agenda`  — dias e horário de atendimento.
--   3. `agendamentos.servico` (enum) vira `servico_id` (chave estrangeira),
--      com o preço COPIADO no momento do agendamento.
--
-- A migração converte os dados existentes antes de apagar a coluna antiga.
-- ============================================================

-- ============================================================
-- 1. Serviços
-- ============================================================

create table if not exists public.servicos (
  id             uuid primary key default gen_random_uuid(),

  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,

  nome           text not null check (length(trim(nome)) > 0),

  -- Dinheiro em centavos, inteiro. Float em dinheiro erra o centavo.
  preco_centavos integer not null default 0 check (preco_centavos >= 0),

  -- O "intervalo" que o dono descreve: quanto tempo da cadeira o serviço
  -- ocupa. É daqui que sai o fim do evento no calendário.
  duracao_min    smallint not null check (duracao_min between 5 and 480),

  -- Nome da cor na paleta categórica da marca, nunca um hex: quem traduz
  -- para cor é o tema, e existe um par claro/escuro medido para cada nome.
  cor            text not null default 'grafite'
                   check (cor in ('azul','verde','violeta','ciano','rosa','grafite')),

  -- Serviço sai de circulação desativado, não apagado: agendamento antigo
  -- continua apontando para ele.
  ativo          boolean not null default true,
  ordem          smallint not null default 0,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.servicos is
  'Cardápio da barbearia. duracao_min é o tempo de cadeira que o serviço ocupa.';

-- Nome repetido só é problema entre os que estão em uso. Desativar "Cabelo"
-- e cadastrar "Cabelo" de novo é legítimo.
create unique index if not exists servicos_nome_ativo_unico
  on public.servicos (barbearia_id, lower(trim(nome)))
  where ativo;

create index if not exists servicos_barbearia_idx
  on public.servicos (barbearia_id, ordem, nome);

drop trigger if exists tocar_servicos on public.servicos;
create trigger tocar_servicos
  before update on public.servicos
  for each row execute function public.tocar_atualizado_em();

alter table public.servicos enable row level security;

drop policy if exists "servicos da propria barbearia" on public.servicos;
create policy "servicos da propria barbearia" on public.servicos
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ============================================================
-- 2. Configuração da agenda
--
-- Uma linha por barbearia — por isso a chave primária É o barbearia_id.
-- Mesmo desenho de 0001: sem tabela de junção, sem id sobrando.
-- ============================================================

create table if not exists public.configuracao_agenda (
  barbearia_id     uuid primary key default auth.uid()
                     references public.barbearias(id) on delete cascade,

  -- 0 = domingo … 6 = sábado. Mesma numeração de JavaScript e do
  -- FullCalendar, para não existir conversão entre banco e tela.
  dias_atendimento smallint[] not null default '{1,2,3,4,5,6}'
                     check (dias_atendimento <@ array[0,1,2,3,4,5,6]::smallint[]),

  -- Hora local da barbearia, sem fuso — mesma decisão de `agendamentos`.
  abre             time not null default '09:00',
  fecha            time not null default '19:00',

  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),

  constraint horario_de_atendimento_valido check (fecha > abre)
);

comment on table public.configuracao_agenda is
  'Dias e horário em que a barbearia atende. Uma linha por barbearia.';

drop trigger if exists tocar_configuracao_agenda on public.configuracao_agenda;
create trigger tocar_configuracao_agenda
  before update on public.configuracao_agenda
  for each row execute function public.tocar_atualizado_em();

alter table public.configuracao_agenda enable row level security;

drop policy if exists "configuracao da propria barbearia" on public.configuracao_agenda;
create policy "configuracao da propria barbearia" on public.configuracao_agenda
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ============================================================
-- 3. Cardápio inicial e configuração padrão
--
-- Toda barbearia que já existe ganha os três serviços que estavam fixos no
-- código, com os mesmos preços, durações e cores — para nada mudar de
-- aparência quando a tela passar a ler do banco.
-- ============================================================

insert into public.servicos (barbearia_id, nome, preco_centavos, duracao_min, cor, ordem)
select b.id, p.nome, p.preco, p.duracao, p.cor, p.ordem
from public.barbearias b
cross join (values
  ('Cabelo',         4500, 30::smallint, 'azul',    1::smallint),
  ('Barba',          3000, 20::smallint, 'verde',   2::smallint),
  ('Cabelo + Barba', 7000, 50::smallint, 'violeta', 3::smallint)
) as p(nome, preco, duracao, cor, ordem)
-- Só semeia quem ainda não tem nenhum serviço: não recriar o que o dono apagou.
where not exists (
  select 1 from public.servicos s where s.barbearia_id = b.id
);

insert into public.configuracao_agenda (barbearia_id)
select id from public.barbearias
on conflict (barbearia_id) do nothing;

-- ============================================================
-- 4. agendamentos: enum → chave estrangeira
-- ============================================================

alter table public.agendamentos
  add column if not exists servico_id uuid
    -- `restrict`, nunca `cascade`: apagar um serviço não pode levar junto o
    -- histórico de quem já foi atendido.
    references public.servicos(id) on delete restrict;

alter table public.agendamentos
  -- Preço COPIADO no momento do agendamento. Reajuste de tabela não pode
  -- reescrever quanto o cliente pagou mês passado. Fica nulo nas linhas
  -- antigas; a aplicação cai no preço atual do serviço nesse caso.
  add column if not exists preco_centavos integer check (preco_centavos >= 0);

create index if not exists agendamentos_servico_idx
  on public.agendamentos (servico_id);

do $$
begin
  -- Só converte se a coluna antiga ainda existir — a migração pode rodar de novo.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agendamentos'
      and column_name = 'servico'
  ) then
    update public.agendamentos a
    set servico_id = s.id
    from public.servicos s
    where s.barbearia_id = a.barbearia_id
      and a.servico_id is null
      and lower(trim(s.nome)) = case a.servico::text
            when 'cabelo'       then 'cabelo'
            when 'barba'        then 'barba'
            when 'cabelo_barba' then 'cabelo + barba'
          end;

    alter table public.agendamentos drop column servico;
    raise notice 'BARBOS: coluna `servico` convertida em `servico_id`.';
  end if;
end $$;

drop type if exists public.servico_barbearia;

-- Congela o preço das linhas que vieram de antes da coluna existir.
update public.agendamentos a
set preco_centavos = s.preco_centavos
from public.servicos s
where s.id = a.servico_id
  and a.preco_centavos is null;

-- `not null` só quando dá: se alguma linha ficou sem serviço (nome do serviço
-- editado à mão, por exemplo), a migração avisa em vez de abortar.
do $$
begin
  if exists (select 1 from public.agendamentos where servico_id is null) then
    raise warning
      'BARBOS: há agendamentos sem servico_id. Corrija e rode de novo para aplicar o NOT NULL.';
  else
    alter table public.agendamentos alter column servico_id set not null;
  end if;
end $$;

-- ============================================================
-- 5. Conta nova nasce com cardápio e configuração
--
-- Substitui a função de 0001 acrescentando as duas semeaduras. É `security
-- definer` porque roda no gatilho de auth.users, onde não há auth.uid().
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

  insert into public.configuracao_agenda (barbearia_id)
  values (new.id)
  on conflict (barbearia_id) do nothing;

  insert into public.servicos (barbearia_id, nome, preco_centavos, duracao_min, cor, ordem)
  select new.id, p.nome, p.preco, p.duracao, p.cor, p.ordem
  from (values
    ('Cabelo',         4500, 30::smallint, 'azul',    1::smallint),
    ('Barba',          3000, 20::smallint, 'verde',   2::smallint),
    ('Cabelo + Barba', 7000, 50::smallint, 'violeta', 3::smallint)
  ) as p(nome, preco, duracao, cor, ordem)
  where not exists (
    select 1 from public.servicos s where s.barbearia_id = new.id
  );

  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

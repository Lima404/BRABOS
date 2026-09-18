-- ============================================================
-- BARBOS — recriar o banco do zero, num projeto Supabase novo
--
-- NÃO é migração. É o atalho para quando não existe mais banco:
-- projeto apagado, projeto novo, ou uma segunda instalação.
--
-- Este arquivo é GERADO: ele é a emenda das migrações da pasta
-- `supabase/migracoes/`, na ordem, sem nenhuma alteração. Se uma
-- migração mudar, regere em vez de editar aqui — duas cópias da
-- mesma regra divergem no primeiro ajuste.
--
-- ============================================================
-- COMO USAR
-- ============================================================
--
--   1. Supabase → SQL Editor → New query
--   2. Cole ESTE ARQUIVO INTEIRO
--   3. Run
--
-- Roda numa transação só. Ou passa tudo, ou não passa nada — não
-- existe o estado de "metade do banco criado".
--
-- Pode rodar de novo sem quebrar: cada migração usa
-- `create ... if not exists`, `create or replace` e blocos `do $$`
-- que engolem "já existe".
--
-- ============================================================
-- O QUE ESTE ARQUIVO CRIA
-- ============================================================
--
-- Tabelas: barbearias, agendamentos, servicos, configuracao_agenda,
-- barbeiros, produtos, vendas, itens_venda, folgas.
-- Mais o RLS de todas elas, as funções públicas da loja e do
-- agendamento online, o resumo do dashboard e o gatilho que monta a
-- barbearia quando alguém se cadastra.
--
-- Ele NÃO traz dado nenhum. Cardápio, equipe e estoque nascem
-- vazios, como deve ser: a conta nova se cadastra em /cadastrar e
-- preenche pela tela.
--
-- ============================================================
-- O QUE FOI DEIXADO DE FORA, E POR QUÊ
-- ============================================================
--
--   0022 — apagava duas barbearias órfãs por id. Num banco novo
--          esses ids não existem.
--   0023 — limpeza total do banco. Aqui seria apagar o que acabou
--          de ser criado.
--   0024 — catálogo global de nomes. Foi aplicado uma vez e
--          desfeito pela 0025; num banco novo, criar para derrubar
--          em seguida é só risco.
--   0025 — o desfazimento da 0024. Sem a 0024, não tem o que
--          desfazer.
--
-- A 0024 guardava `normalizar_nome`, que a 0025 preservava de
-- propósito. Nada no sistema chama essa função — conferido antes de
-- deixá-la de fora. Se um dia ela for usada, copie o bloco da 0024.
--
-- ============================================================
-- DEPOIS DE RODAR — o banco é só metade
-- ============================================================
--
--   1. Authentication → URL Configuration
--      Site URL e Redirect URLs apontando para o domínio de
--      produção e para http://localhost:3000.
--      NÃO use `https://*.vercel.app/**`: o coringa aceita
--      qualquer subdomínio da Vercel, inclusive o de estranhos.
--
--   2. Authentication → Emails
--      O modelo de confirmação está em
--      `supabase/modelos-email/confirmacao.html`.
--
--   3. As chaves novas (URL + publishable key) em DOIS lugares:
--      `sistema/.env.local` e as variáveis de ambiente da Vercel.
--      Trocar só um dos dois é como o ambiente local e a produção
--      passam a falar com bancos diferentes.
--
--   4. /cadastrar, para recriar a conta de teste.
--
-- Conferir se pegou:
--
--   select table_name from information_schema.tables
--   where table_schema = 'public' order by table_name;
--   -- 9 tabelas + a view vendas_no_caixa
-- ============================================================



-- ############################################################
-- ##  0001_barbearias.sql
-- ############################################################

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

-- ############################################################
-- ##  0002_agendamentos.sql
-- ############################################################

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

-- ############################################################
-- ##  0003_servicos_e_configuracao.sql
-- ############################################################

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

-- ############################################################
-- ##  0004_produtos.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0004: produtos (estoque)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001. Pode rodar mais de uma vez sem quebrar.
--
-- Duas prateleiras na mesma tabela, separadas por `tipo`:
--   - mercearia  — o que se vende no balcão (bebida, snack…)
--   - salao      — o que o salão consome (pomada, lâmina, shampoo…)
--
-- Estoque em unidades. Preço é o valor da unidade, em centavos (inteiro).
-- ============================================================

do $$
begin
  create type public.tipo_produto as enum ('mercearia', 'salao');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.produtos (
  id             uuid primary key default gen_random_uuid(),

  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,

  nome           text not null check (length(trim(nome)) > 0),

  -- Quantidade em unidades.
  unidades       integer not null default 0 check (unidades >= 0),

  -- Valor de UMA unidade, em centavos. Float em dinheiro erra o centavo.
  preco_centavos integer not null default 0 check (preco_centavos >= 0),

  tipo           public.tipo_produto not null,

  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

comment on table public.produtos is
  'Estoque da barbearia. tipo separa Mercearia de Produtos de Salão. Quantidade em unidades.';

-- Nome repetido só é problema dentro do mesmo tipo (pode ter "Água" na
-- mercearia e outro item com nome parecido no salão).
create unique index if not exists produtos_nome_tipo_unico
  on public.produtos (barbearia_id, tipo, lower(trim(nome)));

create index if not exists produtos_barbearia_tipo_idx
  on public.produtos (barbearia_id, tipo, nome);

drop trigger if exists tocar_produtos on public.produtos;
create trigger tocar_produtos
  before update on public.produtos
  for each row execute function public.tocar_atualizado_em();

alter table public.produtos enable row level security;

drop policy if exists "produtos da propria barbearia" on public.produtos;
create policy "produtos da propria barbearia" on public.produtos
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ############################################################
-- ##  0005_loja.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0005: a loja (endereço público + vitrine)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001 (contas) e 0004 (produtos). Pode rodar mais de uma vez.
--
-- Numerada 0005 e não 0004: `0004_produtos.sql` já ocupava esse número.
--
-- A loja é aberta: quem lê o QR code na parede da barbearia não tem conta,
-- não tem sessão, e portanto o sistema não tem como saber de qual barbearia
-- se trata. Quem carrega essa informação é a URL — e é por isso que a
-- barbearia precisa de um apelido público (`slug`).
-- ============================================================

alter table public.barbearias
  add column if not exists slug text,
  -- Interruptor da vitrine. Barbearia que não quer vender fecha a loja sem
  -- perder o endereço — o QR code impresso continua valendo quando reabrir.
  add column if not exists loja_ativa boolean not null default true;

-- ---------- apelido a partir do nome ----------
-- Sem a extensão `unaccent`: ela não vem ligada em todo projeto Supabase, e
-- um `translate` resolve o alfabeto português inteiro.
create or replace function public.gerar_slug(texto text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(translate(
        coalesce(texto, ''),
        'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      )),
      '[^a-z0-9]+', '-', 'g'
    )),
    ''
  )
$$;

comment on function public.gerar_slug is
  'Texto livre em apelido de URL. Sem acento, sem espaço, sem maiúscula.';

/*
 * Apelido livre para uma barbearia.
 *
 * Tenta o apelido limpo; se já estiver tomado, cola um pedaço do id no fim.
 * O id é único, então isto nunca entra em laço nem depende de sorte.
 */
create or replace function public.slug_livre(nome text, id uuid)
returns text
language plpgsql
stable
as $$
declare
  base text := coalesce(public.gerar_slug(nome), 'barbearia');
begin
  if not exists (
    select 1 from public.barbearias b
    where b.slug = base and b.id <> slug_livre.id
  ) then
    return base;
  end if;

  return base || '-' || left(replace(id::text, '-', ''), 6);
end $$;

-- ---------- quem já existia ganha apelido ----------
--
-- CUIDADO com o jeito óbvio (`set slug = slug_livre(nome, id)`): dentro de um
-- único UPDATE a função enxerga o banco como estava ANTES do comando, então
-- duas barbearias chamadas "Minha barbearia" — o padrão de toda conta nova —
-- receberiam o mesmo apelido e o índice único abaixo falharia.
--
-- Por isso a numeração: dentro de cada nome repetido, só a primeira fica com
-- o apelido limpo; as outras levam um pedaço do id no fim.
with numeradas as (
  select
    b.id,
    coalesce(public.gerar_slug(b.nome), 'barbearia') as base,
    row_number() over (
      partition by coalesce(public.gerar_slug(b.nome), 'barbearia')
      order by b.criada_em, b.id
    ) as posicao
  from public.barbearias b
  where b.slug is null
)
update public.barbearias b
set slug = case
  when n.posicao = 1
   and not exists (select 1 from public.barbearias o where o.slug = n.base)
  then n.base
  else n.base || '-' || left(replace(b.id::text, '-', ''), 6)
end
from numeradas n
where b.id = n.id;

-- O apelido é o endereço público. Precisa ser único e não pode faltar.
create unique index if not exists barbearias_slug_unico on public.barbearias (slug);

alter table public.barbearias alter column slug set not null;

comment on column public.barbearias.slug is
  'Apelido público da loja (/loja/<slug>). NÃO muda quando o nome muda: o QR code impresso aponta pra cá.';

-- ============================================================
-- A vitrine pública
--
-- `barbearias` continua fechada por RLS (cada dona vê só a si mesma). Esta
-- view é a ÚNICA porta aberta, e mostra só o que uma vitrine precisa: o
-- apelido e o nome. Telefone, id de dono e datas não passam por aqui.
--
-- View comum (sem `security_invoker`) roda com os privilégios de quem a
-- criou, então o RLS da tabela por baixo não se aplica — é exatamente o que
-- queremos, e por isso a lista de colunas acima é curta de propósito.
-- ============================================================

drop view if exists public.lojas;

create view public.lojas
with (security_invoker = false)
as
select
  b.id,
  b.slug,
  b.nome
from public.barbearias b
where b.loja_ativa;

comment on view public.lojas is
  'Vitrine pública das barbearias. Única leitura de barbearias sem sessão.';

grant select on public.lojas to anon, authenticated;

-- ============================================================
-- A vitrine de produtos
--
-- A view é só o GET público (sem sessão). Mercearia e salão passam;
-- quem decide o que aparece na loja é o app: unidades >= 1 e preço > 0.
-- `unidades` e `tipo` vêm na leitura do servidor, mas a UI não mostra
-- quantidade — só nome e preço.
-- ============================================================

drop view if exists public.loja_produtos;

create view public.loja_produtos
with (security_invoker = false)
as
select
  p.id,
  p.barbearia_id,
  p.nome,
  p.preco_centavos,
  p.unidades,
  p.tipo
from public.produtos p
join public.barbearias b on b.id = p.barbearia_id
where b.loja_ativa
  and p.tipo in ('mercearia', 'salao');

comment on view public.loja_produtos is
  'GET público da loja: mercearia e salão. Filtro de vitrine fica no app.';

grant select on public.loja_produtos to anon, authenticated;

-- ============================================================
-- Conta nova já nasce com apelido
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
begin
  -- Duas contas criadas no mesmo instante com o mesmo nome disputariam o
  -- apelido limpo, e a segunda quebraria o cadastro inteiro no índice único.
  -- O `exception` transforma essa corrida em apelido com sufixo.
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

-- ############################################################
-- ##  0006_sem_sobreposicao.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0006: horário não pode pisar em outro
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002 (agendamentos) e 0003 (serviços). Pode rodar mais de uma vez.
--
-- REGRA: uma cadeira, um cliente por vez. Um corte das 9h às 10h bloqueia
-- 9h30, 9h45 e qualquer outro começo dentro desse intervalo.
--
-- A restrição de 0002 (`unique (barbearia_id, data, horario)`) só pegava o
-- MESMO minuto — 9h30 passava direto por cima de um corte de uma hora. Além
-- disso ela não perdoava cancelamento: cancelar as 9h e remarcar as 9h dava
-- erro, ao contrário do que o comentário dela prometia.
-- ============================================================

-- Precisa disto para misturar `uuid with =` e `tsrange with &&` no mesmo
-- índice GiST. Vem disponível no Supabase.
create extension if not exists btree_gist;

-- ============================================================
-- 1. A duração vira dado do agendamento
--
-- Hoje a duração vem de `servicos.duracao_min`. Isso não serve de base para
-- a regra: mudar "Cabelo" de 30 para 60 minutos faria TODO agendamento
-- passado esticar, inventando conflitos que nunca existiram — e mexendo no
-- histórico. Mesma razão de `preco_centavos` ser copiado no ato.
-- ============================================================

alter table public.agendamentos
  add column if not exists duracao_min smallint
    check (duracao_min between 5 and 480);

update public.agendamentos a
set duracao_min = s.duracao_min
from public.servicos s
where s.id = a.servico_id
  and a.duracao_min is null;

do $$
begin
  if exists (select 1 from public.agendamentos where duracao_min is null) then
    raise warning
      'BARBOS: há agendamentos sem duração. Corrija e rode de novo para o NOT NULL.';
  else
    alter table public.agendamentos alter column duracao_min set not null;
  end if;
end $$;

comment on column public.agendamentos.duracao_min is
  'Duração COPIADA do serviço no ato. Reajuste de duração não move horário já marcado.';

-- ============================================================
-- 2. O intervalo ocupado, calculado pelo banco
--
-- Coluna gerada: não dá pra ficar errada, porque ninguém escreve nela.
-- `[)` — começo incluído, fim excluído: das 9h às 10h e das 10h às 11h NÃO
-- se sobrepõem. Sem isso, todo horário emendado seria recusado.
-- ============================================================

alter table public.agendamentos
  add column if not exists periodo tsrange
    generated always as (
      tsrange(
        (data + horario)::timestamp,
        (data + horario)::timestamp + make_interval(mins => duracao_min),
        '[)'
      )
    ) stored;

comment on column public.agendamentos.periodo is
  'Intervalo ocupado na cadeira. Gerado de data+horario+duracao_min.';

-- ============================================================
-- 3. A trava
--
-- Cancelado fica de fora: o horário volta a ficar livre. "Não compareceu"
-- NÃO fica — o cliente furou, mas a cadeira ficou ocupada esperando, e o
-- histórico tem que continuar mostrando isso.
--
-- Se já houver sobreposição no banco, a restrição não pode ser criada. Em vez
-- de abortar a migração inteira, avisamos quais são e deixamos o resto no
-- lugar — a dona corrige e roda de novo.
-- ============================================================

do $$
declare
  conflitos integer;
  amostra text;
begin
  select count(*), string_agg(texto, e'\n  ')
  into conflitos, amostra
  from (
    select format(
             '%s %s (%s) sobrepõe %s (%s)',
             a.data, a.horario, a.cliente_nome, b.horario, b.cliente_nome
           ) as texto
    from public.agendamentos a
    join public.agendamentos b
      on b.barbearia_id = a.barbearia_id
     and b.id > a.id
     and b.periodo && a.periodo
    where a.estado <> 'cancelado'
      and b.estado <> 'cancelado'
    limit 5
  ) as amostras;

  if coalesce(conflitos, 0) > 0 then
    raise warning
      'BARBOS: já existem horários sobrepostos. A trava NÃO foi criada. Corrija estes e rode de novo:%s  %s',
      e'\n', amostra;
    return;
  end if;

  alter table public.agendamentos
    drop constraint if exists agendamento_sem_sobreposicao;

  alter table public.agendamentos
    add constraint agendamento_sem_sobreposicao
    exclude using gist (
      barbearia_id with =,
      periodo with &&
    ) where (estado <> 'cancelado');

  -- Só agora: a antiga era a única proteção até este ponto. E ela precisa
  -- sair — sem `where`, ela recusava remarcar um horário cancelado.
  alter table public.agendamentos
    drop constraint if exists agendamento_sem_choque;

  raise notice 'BARBOS: trava de sobreposição criada.';
end $$;

-- ############################################################
-- ##  0007_vendas_loja.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0007: vendas da loja (mercearia)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0004 e 0005. Pode rodar mais de uma vez sem quebrar.
--
-- O cliente do QR code não tem sessão. Ele NÃO escreve em `produtos` nem
-- em `vendas` direto — só chama a função `confirmar_compra_loja`, que:
--   1. resolve a barbearia pelo slug
--   2. confere se o produto é mercearia e está à venda
--   3. grava a venda com preço congelado
--   4. baixa o estoque (unidades)
-- ============================================================

do $$
begin
  create type public.status_venda as enum ('confirmada', 'cancelada');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.vendas (
  id              uuid primary key default gen_random_uuid(),

  barbearia_id    uuid not null
                    references public.barbearias(id) on delete cascade,

  -- Total em centavos no momento da compra.
  total_centavos  integer not null check (total_centavos >= 0),

  status          public.status_venda not null default 'confirmada',

  criado_em       timestamptz not null default now()
);

comment on table public.vendas is
  'Compra feita na loja pública (QR). Cliente anônimo; barbearia vem do slug.';

create index if not exists vendas_barbearia_criado_idx
  on public.vendas (barbearia_id, criado_em desc);

alter table public.vendas enable row level security;

drop policy if exists "vendas da propria barbearia" on public.vendas;
create policy "vendas da propria barbearia" on public.vendas
  for select
  using (barbearia_id = auth.uid());

-- A dona lê. Insert/update públicos só pela RPC abaixo.

create table if not exists public.itens_venda (
  id              uuid primary key default gen_random_uuid(),

  venda_id        uuid not null
                    references public.vendas(id) on delete cascade,

  produto_id      uuid not null
                    references public.produtos(id) on delete restrict,

  -- Snapshot: reajuste de preço depois não reescreve o que o cliente pagou.
  nome            text not null,
  preco_centavos  integer not null check (preco_centavos >= 0),
  quantidade      integer not null check (quantidade > 0)
);

comment on table public.itens_venda is
  'Itens de uma venda. Nome e preço congelados no momento da compra.';

create index if not exists itens_venda_venda_idx
  on public.itens_venda (venda_id);

create index if not exists itens_venda_produto_idx
  on public.itens_venda (produto_id);

alter table public.itens_venda enable row level security;

drop policy if exists "itens de venda da propria barbearia" on public.itens_venda;
create policy "itens de venda da propria barbearia" on public.itens_venda
  for select
  using (
    exists (
      select 1 from public.vendas v
      where v.id = itens_venda.venda_id
        and v.barbearia_id = auth.uid()
    )
  );

-- ============================================================
-- RPC pública: confirmar compra
--
-- security definer: roda com privilégio do dono da função, atravessa o RLS
-- de produtos/vendas. Por isso a validação é rígida (slug + mercearia +
-- estoque). Grant EXECUTE a anon — sem abrir as tabelas.
-- ============================================================

create or replace function public.confirmar_compra_loja(
  p_slug text,
  p_produto_id uuid,
  p_quantidade integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_produto record;
  v_venda_id uuid;
  v_total integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 99 then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
  end if;

  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta loja não está disponível.');
  end if;

  -- Trava a linha do produto pra duas compras simultâneas não venderem o
  -- mesmo estoque.
  select
    p.id,
    p.nome,
    p.preco_centavos,
    p.unidades,
    p.tipo,
    p.barbearia_id
  into v_produto
  from public.produtos p
  where p.id = p_produto_id
    and p.barbearia_id = v_loja_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado nesta loja.');
  end if;

  if v_produto.tipo not in ('mercearia', 'salao') then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.preco_centavos <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.unidades < p_quantidade then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Não tem essa quantidade disponível. Escolha menos ou pergunte no balcão.'
    );
  end if;

  v_total := v_produto.preco_centavos * p_quantidade;

  insert into public.vendas (barbearia_id, total_centavos, status)
  values (v_loja_id, v_total, 'confirmada')
  returning id into v_venda_id;

  insert into public.itens_venda (
    venda_id, produto_id, nome, preco_centavos, quantidade
  ) values (
    v_venda_id,
    v_produto.id,
    v_produto.nome,
    v_produto.preco_centavos,
    p_quantidade
  );

  update public.produtos
  set unidades = unidades - p_quantidade
  where id = v_produto.id;

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'nome', v_produto.nome,
    'quantidade', p_quantidade
  );
end $$;

comment on function public.confirmar_compra_loja is
  'Compra anônima na loja. Mercearia ou salão com preço > 0; baixa unidades.';

revoke all on function public.confirmar_compra_loja(text, uuid, integer) from public;
grant execute on function public.confirmar_compra_loja(text, uuid, integer)
  to anon, authenticated;

-- ############################################################
-- ##  0008_estoque_sem_caixas.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0008: estoque só em unidades
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0004. Pode rodar mais de uma vez sem quebrar.
--
-- A coluna `caixas` sai: o estoque passa a ser só unidades.
-- ============================================================

alter table public.produtos
  drop column if exists caixas;

comment on table public.produtos is
  'Estoque da barbearia. tipo separa Mercearia de Produtos de Salão. Quantidade em unidades.';

-- ############################################################
-- ##  0009_venda_no_agendamento.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0009: venda ligada ao agendamento do dia
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0004, 0005 e 0007. Pode rodar mais de uma vez.
--
-- O que muda:
--   1. `vendas` ganha `agendamento_id` (nulo = compra avulsa)
--   2. RPC pública `clientes_do_dia_loja` — a lista do seletor
--   3. `confirmar_compra_loja` passa a aceitar o agendamento escolhido
--
-- PRIVACIDADE — leia antes de mexer:
-- a loja abre SEM sessão (é o destino do QR code). Devolver a lista de
-- clientes do dia para qualquer visitante publicaria nome e horário de todo
-- mundo que passou na barbearia, num endereço que qualquer um abre e que o
-- Google indexa. Por isso `clientes_do_dia_loja` só devolve `cliente_nome`
-- quando quem pergunta é a própria dona (auth.uid() = barbearia). Para o
-- visitante anônimo vai só horário e serviço — o bastante para ele dizer
-- "o meu é o das 10:30" sem entregar a agenda alheia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A coluna
-- ------------------------------------------------------------

alter table public.vendas
  add column if not exists agendamento_id uuid
    references public.agendamentos(id) on delete set null;

comment on column public.vendas.agendamento_id is
  'Agendamento a que a compra foi lançada. Nulo = compra avulsa (balcão).';

-- `set null` e não `cascade`: apagar um agendamento não pode apagar a venda
-- junto — o dinheiro entrou de qualquer jeito, e sumir com ele faria o
-- faturamento do dia mudar sozinho.

create index if not exists vendas_agendamento_idx
  on public.vendas (agendamento_id)
  where agendamento_id is not null;

-- ------------------------------------------------------------
-- 2. A lista do seletor
-- ------------------------------------------------------------

create or replace function public.clientes_do_dia_loja(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_eh_dona boolean;
begin
  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return '[]'::jsonb;
  end if;

  v_eh_dona := auth.uid() is not null and auth.uid() = v_loja_id;

  return coalesce(
    (
      select jsonb_agg(linha order by linha->>'horario')
      from (
        select jsonb_build_object(
                 'id', a.id,
                 'horario', to_char(a.horario, 'HH24:MI'),
                 'servico', s.nome,
                 -- Nome só para a dona. Ver o bloco PRIVACIDADE no topo.
                 'clienteNome',
                 case when v_eh_dona then a.cliente_nome else null end
               ) as linha
        from public.agendamentos a
        join public.servicos s on s.id = a.servico_id
        where a.barbearia_id = v_loja_id
          and a.data = p_data
          -- Cancelado e falta não compram nada: quem não veio não leva.
          and a.estado not in ('cancelado', 'faltou')
      ) as linhas
    ),
    '[]'::jsonb
  );
end $$;

comment on function public.clientes_do_dia_loja is
  'Agendamentos do dia para o seletor da loja. Nome do cliente só para a dona.';

revoke all on function public.clientes_do_dia_loja(text, date) from public;
grant execute on function public.clientes_do_dia_loja(text, date)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 3. A compra passa a saber de quem é
-- ------------------------------------------------------------

-- Some com a assinatura de 3 argumentos para não ficarem duas funções com o
-- mesmo nome: o PostgREST escolhe a sobrecarga pelos nomes dos argumentos
-- recebidos, e duas candidatas viram erro de ambiguidade em runtime.
drop function if exists public.confirmar_compra_loja(text, uuid, integer);

create or replace function public.confirmar_compra_loja(
  p_slug text,
  p_produto_id uuid,
  p_quantidade integer,
  p_agendamento_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_produto record;
  v_venda_id uuid;
  v_total integer;
  v_agendamento_id uuid := null;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 99 then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
  end if;

  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta loja não está disponível.');
  end if;

  -- O agendamento tem que ser DESTA barbearia. Sem essa checagem, um id de
  -- outra loja penduraria a compra na conta de um estranho.
  if p_agendamento_id is not null then
    select a.id into v_agendamento_id
    from public.agendamentos a
    where a.id = p_agendamento_id
      and a.barbearia_id = v_loja_id
      and a.estado not in ('cancelado', 'faltou');

    if v_agendamento_id is null then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse agendamento não é mais válido. Escolha de novo ou marque como avulsa.'
      );
    end if;
  end if;

  -- Trava a linha do produto pra duas compras simultâneas não venderem o
  -- mesmo estoque.
  select
    p.id,
    p.nome,
    p.preco_centavos,
    p.unidades,
    p.tipo,
    p.barbearia_id
  into v_produto
  from public.produtos p
  where p.id = p_produto_id
    and p.barbearia_id = v_loja_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado nesta loja.');
  end if;

  if v_produto.tipo not in ('mercearia', 'salao') then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.preco_centavos <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.unidades < p_quantidade then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Não tem essa quantidade disponível. Escolha menos ou pergunte no balcão.'
    );
  end if;

  v_total := v_produto.preco_centavos * p_quantidade;

  insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
  values (v_loja_id, v_total, 'confirmada', v_agendamento_id)
  returning id into v_venda_id;

  insert into public.itens_venda (
    venda_id, produto_id, nome, preco_centavos, quantidade
  ) values (
    v_venda_id,
    v_produto.id,
    v_produto.nome,
    v_produto.preco_centavos,
    p_quantidade
  );

  update public.produtos
  set unidades = unidades - p_quantidade
  where id = v_produto.id;

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'nome', v_produto.nome,
    'quantidade', p_quantidade,
    'agendamento_id', v_agendamento_id
  );
end $$;

comment on function public.confirmar_compra_loja is
  'Compra anônima na loja. Mercearia ou salão com preço > 0; baixa unidades. Pode ser lançada num agendamento do dia.';

revoke all on function public.confirmar_compra_loja(text, uuid, integer, uuid) from public;
grant execute on function public.confirmar_compra_loja(text, uuid, integer, uuid)
  to anon, authenticated;

-- ############################################################
-- ##  0010_nome_no_seletor_da_loja.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0010: o nome do cliente aparece no seletor da loja
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende da 0009. Pode rodar mais de uma vez.
--
-- O que muda: `clientes_do_dia_loja` passa a devolver `cliente_nome` para
-- QUALQUER pessoa, e não só para a dona logada.
--
-- Decisão do Gabriel, tomada com o efeito na mesa: `/loja/<slug>` abre sem
-- sessão, então isto torna público o nome e o horário de quem tem hora
-- marcada hoje — para qualquer um com o link, não só para quem está na
-- barbearia. Foi pedido duas vezes; a 0009 guarda a versão que escondia, e
-- voltar atrás é rodar aquele bloco de novo.
--
-- Só o dia corrente sai daqui: `p_data` vem de quem chama e a agenda de
-- ontem ou de amanhã continua fechada.
-- ============================================================

create or replace function public.clientes_do_dia_loja(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_loja_id uuid;
begin
  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(linha order by linha->>'horario')
      from (
        select jsonb_build_object(
                 'id', a.id,
                 'horario', to_char(a.horario, 'HH24:MI'),
                 'servico', s.nome,
                 'clienteNome', a.cliente_nome
               ) as linha
        from public.agendamentos a
        join public.servicos s on s.id = a.servico_id
        where a.barbearia_id = v_loja_id
          and a.data = p_data
          -- Cancelado e falta não compram nada: quem não veio não leva.
          and a.estado not in ('cancelado', 'faltou')
      ) as linhas
    ),
    '[]'::jsonb
  );
end $$;

comment on function public.clientes_do_dia_loja is
  'Agendamentos do dia para o seletor da loja, com o nome do cliente. Lista pública — ver o cabeçalho da migração 0010.';

revoke all on function public.clientes_do_dia_loja(text, date) from public;
grant execute on function public.clientes_do_dia_loja(text, date)
  to anon, authenticated;

-- ############################################################
-- ##  0011_ajustar_comanda.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0011: editar o consumo de um atendimento
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0004, 0007 e 0009. Pode rodar mais de uma vez.
--
-- Uma função só, `ajustar_comanda`, que recebe a lista inteira de mudanças e
-- aplica TUDO ou NADA. Por que não três funções (alterar, remover,
-- acrescentar) chamadas em sequência pela tela: cada linha da comanda mexe no
-- estoque, e uma sequência que falha no meio deixa o estoque contando
-- unidades que ninguém tirou da prateleira. Erro aqui é `raise`, não
-- `return` — a exceção desfaz o bloco inteiro; um `return` no meio do laço
-- teria gravado o que já passou.
--
-- É operação da DONA, não do cliente do QR: exige sessão e confere que o
-- agendamento é da barbearia logada. Só `authenticated` recebe o grant.
-- ============================================================

create or replace function public.ajustar_comanda(
  p_agendamento_id uuid,
  p_mudancas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
  v_mudanca   jsonb;
  v_item      record;
  v_produto   record;
  v_delta     integer;
  v_qtd       integer;
  v_venda_id  uuid;
  v_mexeu     integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sua sessão expirou. Entre de novo.');
  end if;

  select a.barbearia_id into v_barbearia
  from public.agendamentos a
  where a.id = p_agendamento_id;

  if v_barbearia is null or v_barbearia <> auth.uid() then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento não é desta barbearia.');
  end if;

  if p_mudancas is null or jsonb_typeof(p_mudancas) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Nada para alterar.');
  end if;

  -- Bloco com tratamento = subtransação: o `raise` lá dentro desfaz todas as
  -- linhas já mexidas neste laço, inclusive as baixas de estoque.
  begin
    for v_mudanca in select * from jsonb_array_elements(p_mudancas)
    loop
      v_qtd := coalesce((v_mudanca->>'quantidade')::integer, -1);

      if v_qtd < 0 or v_qtd > 99 then
        raise exception using errcode = 'BR001',
          message = 'Quantidade tem que ser de 0 a 99.';
      end if;

      -- ---------- linha que já existe: alterar ou remover ----------
      if (v_mudanca->>'item_id') is not null then

        select
          i.id,
          i.quantidade,
          i.produto_id,
          i.nome,
          v.id as venda_id
        into v_item
        from public.itens_venda i
        join public.vendas v on v.id = i.venda_id
        where i.id = (v_mudanca->>'item_id')::uuid
          and v.agendamento_id = p_agendamento_id
          and v.barbearia_id = v_barbearia
        for update of i, v;

        if not found then
          raise exception using errcode = 'BR001',
            message = 'Um dos itens já não está neste atendimento. Recarregue a página.';
        end if;

        -- Positivo = vai sair mais do estoque; negativo = volta pra prateleira.
        v_delta := v_qtd - v_item.quantidade;

        if v_delta <> 0 then
          update public.produtos
          set unidades = unidades - v_delta
          where id = v_item.produto_id
            and barbearia_id = v_barbearia
            and unidades - v_delta >= 0;

          if not found then
            raise exception using errcode = 'BR001',
              message = 'Não tem estoque suficiente de ' || v_item.nome || '.';
          end if;
        end if;

        if v_qtd = 0 then
          delete from public.itens_venda where id = v_item.id;
        else
          update public.itens_venda set quantidade = v_qtd where id = v_item.id;
        end if;

        v_mexeu := v_mexeu + 1;

      -- ---------- linha nova: acrescentar ----------
      elsif (v_mudanca->>'produto_id') is not null then

        if v_qtd < 1 then
          continue;
        end if;

        select p.id, p.nome, p.preco_centavos, p.unidades
        into v_produto
        from public.produtos p
        where p.id = (v_mudanca->>'produto_id')::uuid
          and p.barbearia_id = v_barbearia
        for update;

        if not found then
          raise exception using errcode = 'BR001',
            message = 'Produto não encontrado nesta barbearia.';
        end if;

        if v_produto.preco_centavos <= 0 then
          raise exception using errcode = 'BR001',
            message = v_produto.nome || ' está sem preço. Defina no estoque antes de lançar.';
        end if;

        if v_produto.unidades < v_qtd then
          raise exception using errcode = 'BR001',
            message = 'Só tem ' || v_produto.unidades || ' un. de ' || v_produto.nome || '.';
        end if;

        -- Uma venda por lançamento, igual à loja: assim o histórico continua
        -- sendo "o que foi comprado numa hora", e não um saco que cresce.
        insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
        values (
          v_barbearia,
          v_produto.preco_centavos * v_qtd,
          'confirmada',
          p_agendamento_id
        )
        returning id into v_venda_id;

        -- Nome e preço congelados aqui, como na compra pela loja.
        insert into public.itens_venda (
          venda_id, produto_id, nome, preco_centavos, quantidade
        ) values (
          v_venda_id,
          v_produto.id,
          v_produto.nome,
          v_produto.preco_centavos,
          v_qtd
        );

        update public.produtos
        set unidades = unidades - v_qtd
        where id = v_produto.id;

        v_mexeu := v_mexeu + 1;

      else
        raise exception using errcode = 'BR001',
          message = 'Mudança sem item_id nem produto_id.';
      end if;
    end loop;

    -- O total da venda é derivado dos itens: recalcular é mais barato que
    -- manter somado à mão em três lugares e descobrir a diferença no caixa.
    update public.vendas v
    set total_centavos = coalesce(
      (select sum(i.preco_centavos * i.quantidade)
         from public.itens_venda i
        where i.venda_id = v.id),
      0
    )
    where v.agendamento_id = p_agendamento_id
      and v.barbearia_id = v_barbearia;

    -- Venda que ficou sem item nenhum sai: R$ 0,00 pendurado no atendimento
    -- vira linha fantasma no relatório.
    delete from public.vendas v
    where v.agendamento_id = p_agendamento_id
      and v.barbearia_id = v_barbearia
      and not exists (
        select 1 from public.itens_venda i where i.venda_id = v.id
      );

  exception
    when sqlstate 'BR001' then
      -- Só o erro de regra vira resposta. Falha de verdade (constraint,
      -- deadlock) sobe e aborta tudo, que é o que deve acontecer.
      return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'mudancas', v_mexeu);
end $$;

comment on function public.ajustar_comanda is
  'Altera, remove e acrescenta itens do consumo de um atendimento, ajustando o estoque. Tudo ou nada.';

revoke all on function public.ajustar_comanda(uuid, jsonb) from public;
grant execute on function public.ajustar_comanda(uuid, jsonb) to authenticated;

-- ############################################################
-- ##  0012_carrinho_loja.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0012: carrinho na loja (vários itens, uma venda)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0007 e 0009. Pode rodar mais de uma vez sem quebrar.
--
-- O cliente do QR monta um pedido com vários produtos e confirma uma
-- vez. Uma venda, vários `itens_venda`, estoque baixado na mesma
-- transação. A RPC de um item (`confirmar_compra_loja`) continua.
-- ============================================================

create or replace function public.confirmar_carrinho_loja(
  p_slug text,
  p_itens jsonb,
  p_agendamento_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_agendamento_id uuid := null;
  v_venda_id uuid;
  v_total integer := 0;
  v_qtd_unidades integer := 0;
  v_qtd_linhas integer := 0;
  v_produto record;
  r record;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Escolha pelo menos um produto.');
  end if;

  if jsonb_array_length(p_itens) < 1 or jsonb_array_length(p_itens) > 40 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha entre 1 e 40 produtos no pedido.');
  end if;

  -- Formato: cada elemento precisa de produto_id (uuid) e quantidade (1–99).
  if exists (
    select 1
    from jsonb_array_elements(p_itens) elem
    where (elem->>'produto_id') is null
       or (elem->>'quantidade') is null
       or (elem->>'quantidade') !~ '^[0-9]+$'
       or (elem->>'quantidade')::integer < 1
       or (elem->>'quantidade')::integer > 99
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
  end if;

  begin
    perform (elem->>'produto_id')::uuid
    from jsonb_array_elements(p_itens) elem;
  exception
    when others then
      return jsonb_build_object('ok', false, 'erro', 'Produto inválido no pedido.');
  end;

  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta loja não está disponível.');
  end if;

  if p_agendamento_id is not null then
    select a.id into v_agendamento_id
    from public.agendamentos a
    where a.id = p_agendamento_id
      and a.barbearia_id = v_loja_id
      and a.estado not in ('cancelado', 'faltou');

    if v_agendamento_id is null then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse agendamento não é mais válido. Escolha de novo ou marque como avulsa.'
      );
    end if;
  end if;

  -- Agrupa o mesmo produto e trava em ordem de id (evita deadlock).
  for r in
    select
      (elem->>'produto_id')::uuid as produto_id,
      sum((elem->>'quantidade')::integer)::integer as quantidade
    from jsonb_array_elements(p_itens) elem
    group by 1
    order by 1
  loop
    if r.quantidade > 99 then
      return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
    end if;

    select
      p.id,
      p.nome,
      p.preco_centavos,
      p.unidades,
      p.tipo
    into v_produto
    from public.produtos p
    where p.id = r.produto_id
      and p.barbearia_id = v_loja_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado nesta loja.');
    end if;

    if v_produto.tipo not in ('mercearia', 'salao') or v_produto.preco_centavos <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
    end if;

    if v_produto.unidades < r.quantidade then
      return jsonb_build_object(
        'ok', false,
        'erro', format(
          'Não tem quantidade suficiente de %s. Escolha menos ou pergunte no balcão.',
          v_produto.nome
        )
      );
    end if;

    v_total := v_total + (v_produto.preco_centavos * r.quantidade);
    v_qtd_unidades := v_qtd_unidades + r.quantidade;
    v_qtd_linhas := v_qtd_linhas + 1;
  end loop;

  if v_qtd_linhas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha pelo menos um produto.');
  end if;

  insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
  values (v_loja_id, v_total, 'confirmada', v_agendamento_id)
  returning id into v_venda_id;

  for r in
    select
      (elem->>'produto_id')::uuid as produto_id,
      sum((elem->>'quantidade')::integer)::integer as quantidade
    from jsonb_array_elements(p_itens) elem
    group by 1
    order by 1
  loop
    select p.id, p.nome, p.preco_centavos
    into v_produto
    from public.produtos p
    where p.id = r.produto_id
      and p.barbearia_id = v_loja_id;

    insert into public.itens_venda (
      venda_id, produto_id, nome, preco_centavos, quantidade
    ) values (
      v_venda_id,
      v_produto.id,
      v_produto.nome,
      v_produto.preco_centavos,
      r.quantidade
    );

    update public.produtos
    set unidades = unidades - r.quantidade
    where id = v_produto.id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'quantidade', v_qtd_unidades,
    'itens', v_qtd_linhas,
    'agendamento_id', v_agendamento_id
  );
end $$;

comment on function public.confirmar_carrinho_loja is
  'Pedido anônimo na loja com vários itens. Uma venda; baixa estoque de todos.';

revoke all on function public.confirmar_carrinho_loja(text, jsonb, uuid) from public;
grant execute on function public.confirmar_carrinho_loja(text, jsonb, uuid)
  to anon, authenticated;

-- ############################################################
-- ##  0013_resumo_dashboard.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0013: os números do dashboard
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0003, 0007 e 0009. Pode rodar mais de uma vez.
--
-- Uma função só, `resumo_dashboard`, que devolve o mês pedido e a série de
-- TODOS os meses numa ida só. Somar isso no navegador exigiria baixar o
-- histórico inteiro a cada abertura da tela — e ainda erraria o mês das
-- vendas, porque `criado_em` é timestamptz e o corte de mês é o do relógio
-- da barbearia, não o de Greenwich.
--
-- `security invoker`: o RLS de agendamentos, vendas e itens_venda já limita
-- tudo à barbearia logada. Definer aqui só ampliaria o alcance sem precisão.
--
-- O QUE ENTRA NA CONTA — a regra vive aqui, e é a única cópia dela:
--   serviço = agendamento com estado 'concluido' (foi atendido e pago)
--   loja    = venda com status 'confirmada'
--
-- Repare que a venda NÃO exige agendamento concluído. Ela é o próprio
-- pagamento: quem leu o QR e levou o refrigerante pagou no balcão, sem passar
-- pela cadeira. Amarrar a receita da loja ao estado do agendamento apagaria
-- toda a venda avulsa — que é justamente para quem a loja foi feita.
-- ============================================================

create or replace function public.resumo_dashboard(p_mes text)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_inicio   date;
  v_fim      date;
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint;
  v_atendimentos     bigint;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb;
  v_produtos jsonb;
  v_meses    jsonb;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'mes deve estar no formato AAAA-MM';
  end if;

  v_inicio := (p_mes || '-01')::date;
  v_fim := (v_inicio + interval '1 month')::date;

  -- ---------- cartões do mês ----------

  select coalesce(sum(a.preco_centavos), 0), count(*)
  into v_servico_centavos, v_atendimentos
  from public.agendamentos a
  where a.estado = 'concluido'
    and a.data >= v_inicio
    and a.data < v_fim;

  select coalesce(sum(v.total_centavos), 0), count(*)
  into v_loja_centavos, v_vendas
  from public.vendas v
  where v.status = 'confirmada'
    and (v.criado_em at time zone v_fuso)::date >= v_inicio
    and (v.criado_em at time zone v_fuso)::date < v_fim;

  -- ---------- pizza 1: serviços do mês ----------
  -- Quantidade E dinheiro na mesma linha: o serviço mais pedido nem sempre é
  -- o que mais rende, e essa diferença é metade do que a tela tem a dizer.

  select coalesce(jsonb_agg(linha order by (linha->>'totalCentavos')::bigint desc), '[]'::jsonb)
  into v_servicos
  from (
    select jsonb_build_object(
             'id', s.id,
             'nome', s.nome,
             'cor', s.cor,
             'quantidade', count(*),
             'totalCentavos', coalesce(sum(a.preco_centavos), 0)
           ) as linha
    from public.agendamentos a
    join public.servicos s on s.id = a.servico_id
    where a.estado = 'concluido'
      and a.data >= v_inicio
      and a.data < v_fim
    group by s.id, s.nome, s.cor
  ) t;

  -- ---------- pizza 2: produtos vendidos no mês ----------
  -- Agrupa por NOME, não por produto_id: o nome é o congelado na venda, e é
  -- o que a dona reconhece. Produto renomeado depois não some do passado.

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= v_inicio
      and (v.criado_em at time zone v_fuso)::date < v_fim
    group by i.nome
  ) t;

  -- ---------- série de todos os meses ----------
  -- Do primeiro movimento até o mês atual, SEM buraco: mês parado precisa
  -- aparecer como zero. Se ele sumisse da série, a barra do lado encostaria
  -- na seguinte e o gráfico contaria uma continuidade que não houve.

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas v where v.status = 'confirmada')
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      v_inicio
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', (
                 select coalesce(sum(a.preco_centavos), 0)
                 from public.agendamentos a
                 where a.estado = 'concluido'
                   and a.data >= m.mes
                   and a.data < (m.mes + interval '1 month')::date
               ),
               'lojaCentavos', (
                 select coalesce(sum(v.total_centavos), 0)
                 from public.vendas v
                 where v.status = 'confirmada'
                   and (v.criado_em at time zone v_fuso)::date >= m.mes
                   and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
               ),
               'atendimentos', (
                 select count(*)
                 from public.agendamentos a
                 where a.estado = 'concluido'
                   and a.data >= m.mes
                   and a.data < (m.mes + interval '1 month')::date
               )
             ) as linha
      from (
        select generate_series(
                 date_trunc('month', v_primeiro)::date,
                 v_ultimo,
                 interval '1 month'
               )::date as mes
      ) m
    ) t;
  end if;

  return jsonb_build_object(
    'mes', p_mes,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', v_produtos,
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Números do dashboard: cartões do mês, serviços, produtos e a série de todos os meses. Serviço conta se concluído; venda conta se confirmada.';

revoke all on function public.resumo_dashboard(text) from public;
grant execute on function public.resumo_dashboard(text) to authenticated;

-- ############################################################
-- ##  0014_barbeiros.sql
-- ############################################################

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

-- ############################################################
-- ##  0015_agendamento_barbeiro.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0015: agendamento ligado ao barbeiro
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0006 e 0014. Pode rodar mais de uma vez.
--
-- Cada horário passa a pertencer a um barbeiro. Dois barbeiros
-- podem atender no mesmo instante; o mesmo barbeiro não.
-- ============================================================

alter table public.agendamentos
  add column if not exists barbeiro_id uuid
    references public.barbeiros(id) on delete restrict;

comment on column public.agendamentos.barbeiro_id is
  'Quem atende. Agenda própria por barbeiro.';

-- Horários antigos: caem no primeiro barbeiro ativo da loja (se houver).
update public.agendamentos a
set barbeiro_id = (
  select b.id
  from public.barbeiros b
  where b.barbearia_id = a.barbearia_id
    and b.ativo
  order by b.nome
  limit 1
)
where a.barbeiro_id is null;

create index if not exists agendamentos_barbeiro_data_idx
  on public.agendamentos (barbeiro_id, data, horario)
  where barbeiro_id is not null;

-- A trava deixa de ser "uma cadeira na loja" e passa a ser
-- "uma cadeira por barbeiro". Quem ainda não tem barbeiro (loja
-- sem equipe) fica fora da exclusão — a app exige barbeiro ao marcar.
do $$
begin
  alter table public.agendamentos
    drop constraint if exists agendamento_sem_sobreposicao;

  alter table public.agendamentos
    add constraint agendamento_sem_sobreposicao
    exclude using gist (
      barbearia_id with =,
      barbeiro_id with =,
      periodo with &&
    ) where (estado <> 'cancelado' and barbeiro_id is not null);

  raise notice 'BARBOS: trava de sobreposição por barbeiro.';
exception
  when others then
    raise warning
      'BARBOS: não consegui recriar a trava (%). Corrija conflitos e rode de novo.',
      SQLERRM;
end $$;

-- ############################################################
-- ##  0016_dashboard_filtros.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0016: dashboard com filtros
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0013, 0014 e 0015. Pode rodar mais de uma vez.
--
-- Troca `resumo_dashboard(mês)` por intervalo de datas + filtros
-- opcionais: serviços, barbeiros, só loja.
-- ============================================================

drop function if exists public.resumo_dashboard(text);

create or replace function public.resumo_dashboard(
  p_inicio date,
  p_fim date,
  p_servico_ids uuid[] default null,
  p_barbeiro_ids uuid[] default null,
  p_so_loja boolean default false
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint := 0;
  v_atendimentos     bigint := 0;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb := '[]'::jsonb;
  v_produtos jsonb;
  v_meses    jsonb;

  v_filtra_servico  boolean;
  v_filtra_barbeiro boolean;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;

  -- ---------- cartões do período ----------

  if not coalesce(p_so_loja, false) then
    select coalesce(sum(a.preco_centavos), 0), count(*)
    into v_servico_centavos, v_atendimentos
    from public.agendamentos a
    where a.estado = 'concluido'
      and a.data >= p_inicio
      and a.data < p_fim
      and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
      and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids));
  end if;

  select coalesce(sum(v.total_centavos), 0), count(*)
  into v_loja_centavos, v_vendas
  from public.vendas v
  where v.status = 'confirmada'
    and (v.criado_em at time zone v_fuso)::date >= p_inicio
    and (v.criado_em at time zone v_fuso)::date < p_fim
    and (
      not v_filtra_barbeiro
      or exists (
        select 1
        from public.agendamentos a
        where a.id = v.agendamento_id
          and a.barbeiro_id = any (p_barbeiro_ids)
      )
    );

  -- ---------- pizza 1: serviços ----------

  if not coalesce(p_so_loja, false) then
    select coalesce(jsonb_agg(linha order by (linha->>'totalCentavos')::bigint desc), '[]'::jsonb)
    into v_servicos
    from (
      select jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'quantidade', count(*),
               'totalCentavos', coalesce(sum(a.preco_centavos), 0)
             ) as linha
      from public.agendamentos a
      join public.servicos s on s.id = a.servico_id
      where a.estado = 'concluido'
        and a.data >= p_inicio
        and a.data < p_fim
        and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
        and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
      group by s.id, s.nome, s.cor
    ) t;
  end if;

  -- ---------- pizza 2: produtos ----------

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (
        not v_filtra_barbeiro
        or exists (
          select 1
          from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      )
    group by i.nome
  ) t;

  -- ---------- série mensal (mesmos filtros de serviço/barbeiro/loja) ----------

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas v where v.status = 'confirmada')
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      date_trunc('month', p_inicio)::date
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select coalesce(sum(a.preco_centavos), 0)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end,
               'lojaCentavos', (
                 select coalesce(sum(v.total_centavos), 0)
                 from public.vendas v
                 where v.status = 'confirmada'
                   and (v.criado_em at time zone v_fuso)::date >= m.mes
                   and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                   and (
                     not v_filtra_barbeiro
                     or exists (
                       select 1 from public.agendamentos a
                       where a.id = v.agendamento_id
                         and a.barbeiro_id = any (p_barbeiro_ids)
                     )
                   )
               ),
               'atendimentos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select count(*)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end
             ) as linha
      from (
        select generate_series(
                 date_trunc('month', v_primeiro)::date,
                 v_ultimo,
                 interval '1 month'
               )::date as mes
      ) m
    ) t;
  end if;

  return jsonb_build_object(
    'mes', to_char(p_inicio, 'YYYY-MM'),
    'inicio', p_inicio,
    'fim', p_fim,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', coalesce(v_produtos, '[]'::jsonb),
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Números do dashboard no intervalo [inicio, fim). Filtros: serviços, barbeiros, só loja.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], boolean)
  to authenticated;

-- ############################################################
-- ##  0017_dashboard_produtos.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0017: filtro de produtos da loja no dashboard
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0016. Pode rodar mais de uma vez.
--
-- Acrescenta `p_produto_ids`: quando informado, a receita da loja e a pizza
-- de produtos consideram só esses itens (mesma regra da vitrine na UI).
-- ============================================================

drop function if exists public.resumo_dashboard(date, date, uuid[], uuid[], boolean);

create or replace function public.resumo_dashboard(
  p_inicio date,
  p_fim date,
  p_servico_ids uuid[] default null,
  p_barbeiro_ids uuid[] default null,
  p_produto_ids uuid[] default null,
  p_so_loja boolean default false
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint := 0;
  v_atendimentos     bigint := 0;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb := '[]'::jsonb;
  v_produtos jsonb;
  v_meses    jsonb;

  v_filtra_servico  boolean;
  v_filtra_barbeiro boolean;
  v_filtra_produto  boolean;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;
  v_filtra_produto := p_produto_ids is not null and cardinality(p_produto_ids) > 0;

  if not coalesce(p_so_loja, false) then
    select coalesce(sum(a.preco_centavos), 0), count(*)
    into v_servico_centavos, v_atendimentos
    from public.agendamentos a
    where a.estado = 'concluido'
      and a.data >= p_inicio
      and a.data < p_fim
      and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
      and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids));
  end if;

  -- Com filtro de produto: soma as LINHAS, não o total da venda inteira.
  if v_filtra_produto then
    select coalesce(sum(i.preco_centavos * i.quantidade), 0),
           count(distinct v.id)
    into v_loja_centavos, v_vendas
    from public.itens_venda i
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and i.produto_id = any (p_produto_ids)
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas v
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
  end if;

  if not coalesce(p_so_loja, false) then
    select coalesce(jsonb_agg(linha order by (linha->>'totalCentavos')::bigint desc), '[]'::jsonb)
    into v_servicos
    from (
      select jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'quantidade', count(*),
               'totalCentavos', coalesce(sum(a.preco_centavos), 0)
             ) as linha
      from public.agendamentos a
      join public.servicos s on s.id = a.servico_id
      where a.estado = 'concluido'
        and a.data >= p_inicio
        and a.data < p_fim
        and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
        and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
      group by s.id, s.nome, s.cor
    ) t;
  end if;

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      )
    group by i.nome
  ) t;

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas v where v.status = 'confirmada')
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      date_trunc('month', p_inicio)::date
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select coalesce(sum(a.preco_centavos), 0)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end,
               'lojaCentavos', case
                 when v_filtra_produto then (
                   select coalesce(sum(i.preco_centavos * i.quantidade), 0)
                   from public.itens_venda i
                   join public.vendas v on v.id = i.venda_id
                   where v.status = 'confirmada'
                     and (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas v
                   where v.status = 'confirmada'
                     and (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
                 )
               end,
               'atendimentos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select count(*)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end
             ) as linha
      from (
        select generate_series(
                 date_trunc('month', v_primeiro)::date,
                 v_ultimo,
                 interval '1 month'
               )::date as mes
      ) m
    ) t;
  end if;

  return jsonb_build_object(
    'mes', to_char(p_inicio, 'YYYY-MM'),
    'inicio', p_inicio,
    'fim', p_fim,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', coalesce(v_produtos, '[]'::jsonb),
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Números do dashboard no intervalo [inicio, fim). Filtros: serviços, barbeiros, produtos, só loja.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;

-- ############################################################
-- ##  0018_agendamento_online.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0018: agendamento online (link público)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0003, 0005, 0006, 0014 e 0015. Pode rodar mais de uma vez.
--
-- Duas funções, ambas para quem NÃO tem conta — o cliente que recebeu o link:
--   1. `agenda_publica`      — o que a tela precisa para desenhar o dia
--   2. `criar_agendamento_publico` — a marcação em si
--
-- PRIVACIDADE — a régua aqui é mais apertada que a da loja:
-- a tela pública precisa mostrar o que está OCUPADO, e nada além disso. Vão
-- horário e duração; NÃO vai nome de cliente, nem observação, nem telefone de
-- barbeiro. Quem quer marcar às 10h só precisa saber que as 10h estão presas —
-- de quem elas são não é da conta dele.
-- ============================================================

-- ------------------------------------------------------------
-- 1. O que a tela pública lê
-- ------------------------------------------------------------

create or replace function public.agenda_publica(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text;
  v_cfg  record;
begin
  select b.id, b.nome into v_id, v_nome
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),

    -- Sem linha de configuração, o padrão do app: seg-sáb, 9h às 19h.
    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00')
    ),

    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'duracaoMin', s.duracao_min,
               'precoCentavos', s.preco_centavos,
               'ativo', true,
               'ordem', s.ordem
             ) order by s.ordem, s.nome)
      from public.servicos s
      where s.barbearia_id = v_id and s.ativo
    ), '[]'::jsonb),

    -- Telefone do barbeiro NÃO sai: é dado da equipe, não do atendimento.
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome)
             order by b.nome)
      from public.barbeiros b
      where b.barbearia_id = v_id and b.ativo
    ), '[]'::jsonb),

    -- Só o retângulo ocupado. Ver o bloco PRIVACIDADE no topo.
    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'barbeiroId', a.barbeiro_id,
               'horario', to_char(a.horario, 'HH24:MI'),
               'duracaoMin', a.duracao_min
             ) order by a.horario)
      from public.agendamentos a
      where a.barbearia_id = v_id
        and a.data = p_data
        and a.estado <> 'cancelado'
        and a.barbeiro_id is not null
    ), '[]'::jsonb)
  );
end $$;

comment on function public.agenda_publica is
  'Dados da tela pública de agendamento. Sem nome de cliente e sem telefone de barbeiro.';

revoke all on function public.agenda_publica(text, date) from public;
grant execute on function public.agenda_publica(text, date) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. A marcação feita pelo cliente
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico(
  p_slug text,
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
set search_path = public
as $$
declare
  v_fuso    text := 'America/Sao_Paulo';
  v_hoje    date := (now() at time zone v_fuso)::date;
  v_id      uuid;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_abre    time;
  v_fecha   time;
  v_fim     time;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  -- ---- nome ----
  v_nome := btrim(coalesce(p_cliente_nome, ''));
  if length(v_nome) < 2 or length(v_nome) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  -- ---- serviço ----
  select s.id, s.duracao_min, s.preco_centavos
  into v_servico
  from public.servicos s
  where s.id = p_servico_id and s.barbearia_id = v_id and s.ativo;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível. Escolha outro.');
  end if;

  -- ---- barbeiro ----
  if not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_id and b.ativo
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro indisponível. Escolha outro.');
  end if;

  -- ---- janela de datas ----
  -- Passado não se marca, e 90 dias é o teto: sem isso, um endereço público
  -- aceitaria encher a agenda de 2030 inteira em um laço.
  if p_data < v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Essa data já passou.');
  end if;
  if p_data > v_hoje + 90 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para marcar com até 90 dias de antecedência.');
  end if;

  -- ---- expediente ----
  select c.dias_atendimento, c.abre, c.fecha into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias  := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);
  v_abre  := coalesce(v_cfg.abre,  '09:00'::time);
  v_fecha := coalesce(v_cfg.fecha, '19:00'::time);

  if not (extract(dow from p_data)::smallint = any (v_dias)) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não atende nesse dia.');
  end if;

  v_fim := p_horario + make_interval(mins => v_servico.duracao_min);

  if p_horario < v_abre or v_fim > v_fecha then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Fora do horário de atendimento (' ||
              to_char(v_abre, 'HH24:MI') || ' às ' || to_char(v_fecha, 'HH24:MI') || ').'
    );
  end if;

  if extract(minute from p_horario)::int % 5 <> 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um horário fechado (de 5 em 5 minutos).');
  end if;

  -- ---- grava ----
  -- Preço e duração congelados aqui, como em toda marcação: reajuste depois
  -- não reescreve o que foi combinado.
  begin
    insert into public.agendamentos (
      barbearia_id, barbeiro_id, cliente_nome, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_nome, v_servico.id,
      p_data, p_horario, 'agendado',
      v_servico.preco_centavos, v_servico.duracao_min,
      nullif(btrim(coalesce(p_observacao, '')), '')
    );
  exception
    -- A trava `agendamento_sem_sobreposicao` é quem decide de verdade: entre
    -- a tela desenhar o dia e o cliente tocar em confirmar, outra pessoa pode
    -- ter pegado o mesmo horário.
    when exclusion_violation then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse horário acabou de ser ocupado. Escolha outro.'
      );
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Dados inválidos para este agendamento.');
  end;

  return jsonb_build_object(
    'ok', true,
    'horario', to_char(p_horario, 'HH24:MI'),
    'data', p_data
  );
end $$;

comment on function public.criar_agendamento_publico is
  'Marcação feita pelo cliente, sem conta. Valida slug, serviço, barbeiro, janela de datas e expediente.';

revoke all on function public.criar_agendamento_publico(text, text, uuid, uuid, date, time, text) from public;
grant execute on function public.criar_agendamento_publico(text, text, uuid, uuid, date, time, text)
  to anon, authenticated;

-- ############################################################
-- ##  0019_horario_por_turno.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0019: horário de atendimento por turno
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0003 e 0018. Pode rodar mais de uma vez.
--
-- `por_turno = false` → um intervalo contínuo (abre/fecha), como sempre.
-- `por_turno = true`  → manhã e tarde; abre/fecha viram o envelope
--                       do dia (abre da manhã → fecha da tarde).
-- ============================================================

alter table public.configuracao_agenda
  add column if not exists por_turno boolean not null default false,
  add column if not exists manha_abre  time,
  add column if not exists manha_fecha time,
  add column if not exists tarde_abre  time,
  add column if not exists tarde_fecha time;

-- Se uma versão anterior desta migração criou o turno da noite, some.
alter table public.configuracao_agenda
  drop column if exists noite_abre,
  drop column if exists noite_fecha;

alter table public.configuracao_agenda
  drop constraint if exists horario_de_atendimento_valido;

alter table public.configuracao_agenda
  drop constraint if exists horario_de_atendimento_por_turno;

alter table public.configuracao_agenda
  add constraint horario_de_atendimento_por_turno check (
    (
      por_turno = false
      and fecha > abre
    )
    or (
      por_turno = true
      and manha_abre is not null and manha_fecha is not null
      and tarde_abre is not null and tarde_fecha is not null
      and manha_fecha > manha_abre
      and tarde_fecha > tarde_abre
      and manha_fecha <= tarde_abre
      and abre = manha_abre
      and fecha = tarde_fecha
    )
  );

comment on column public.configuracao_agenda.por_turno is
  'Se true, o expediente é manhã/tarde; se false, um único abre/fecha.';

-- ------------------------------------------------------------
-- agenda_publica — devolve também os turnos
-- ------------------------------------------------------------

create or replace function public.agenda_publica(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text;
  v_cfg  record;
begin
  select b.id, b.nome into v_id, v_nome
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),

    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00'),
      'porTurno', coalesce(v_cfg.por_turno, false),
      'manha', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.manha_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.manha_fecha, 'HH24:MI')
               ) else null end,
      'tarde', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.tarde_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.tarde_fecha, 'HH24:MI')
               ) else null end
    ),

    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'duracaoMin', s.duracao_min,
               'precoCentavos', s.preco_centavos,
               'ativo', true,
               'ordem', s.ordem
             ) order by s.ordem, s.nome)
      from public.servicos s
      where s.barbearia_id = v_id and s.ativo
    ), '[]'::jsonb),

    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome)
             order by b.nome)
      from public.barbeiros b
      where b.barbearia_id = v_id and b.ativo
    ), '[]'::jsonb),

    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'barbeiroId', a.barbeiro_id,
               'horario', to_char(a.horario, 'HH24:MI'),
               'duracaoMin', a.duracao_min
             ) order by a.horario)
      from public.agendamentos a
      where a.barbearia_id = v_id
        and a.data = p_data
        and a.estado <> 'cancelado'
        and a.barbeiro_id is not null
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------
-- criar_agendamento_publico — cabe em ALGUM turno (ou no intervalo único)
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico(
  p_slug text,
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
  v_id      uuid;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_fim     time;
  v_ok      boolean := false;
  v_rotulo  text;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  v_nome := btrim(coalesce(p_cliente_nome, ''));
  if length(v_nome) < 2 or length(v_nome) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  select s.id, s.duracao_min, s.preco_centavos into v_servico
  from public.servicos s
  where s.id = p_servico_id and s.barbearia_id = v_id and s.ativo;

  if v_servico.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível. Escolha outro.');
  end if;

  if not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_id and b.ativo
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro indisponível. Escolha outro.');
  end if;

  if p_data < v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Essa data já passou.');
  end if;
  if p_data > v_hoje + 90 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para marcar com até 90 dias de antecedência.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);

  if not (extract(dow from p_data)::smallint = any (v_dias)) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não atende nesse dia.');
  end if;

  v_fim := p_horario + make_interval(mins => v_servico.duracao_min);

  if coalesce(v_cfg.por_turno, false) then
    if p_horario >= v_cfg.manha_abre and v_fim <= v_cfg.manha_fecha then
      v_ok := true;
    elsif p_horario >= v_cfg.tarde_abre and v_fim <= v_cfg.tarde_fecha then
      v_ok := true;
    end if;
    v_rotulo :=
      to_char(v_cfg.manha_abre, 'HH24:MI') || '–' || to_char(v_cfg.manha_fecha, 'HH24:MI') ||
      ', ' ||
      to_char(v_cfg.tarde_abre, 'HH24:MI') || '–' || to_char(v_cfg.tarde_fecha, 'HH24:MI');
  else
    v_ok := p_horario >= coalesce(v_cfg.abre, '09:00'::time)
        and v_fim <= coalesce(v_cfg.fecha, '19:00'::time);
    v_rotulo :=
      to_char(coalesce(v_cfg.abre, '09:00'::time), 'HH24:MI') || ' às ' ||
      to_char(coalesce(v_cfg.fecha, '19:00'::time), 'HH24:MI');
  end if;

  if not v_ok then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Fora do horário de atendimento (' || v_rotulo || ').'
    );
  end if;

  if extract(minute from p_horario)::int % 5 <> 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um horário fechado (de 5 em 5 minutos).');
  end if;

  begin
    insert into public.agendamentos (
      barbearia_id, barbeiro_id, cliente_nome, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_nome, v_servico.id,
      p_data, p_horario, 'agendado',
      v_servico.preco_centavos, v_servico.duracao_min,
      nullif(btrim(coalesce(p_observacao, '')), '')
    );
  exception
    when exclusion_violation then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse horário acabou de ser ocupado. Escolha outro.'
      );
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Dados inválidos para este agendamento.');
  end;

  return jsonb_build_object(
    'ok', true,
    'horario', to_char(p_horario, 'HH24:MI'),
    'data', p_data
  );
end $$;

-- ############################################################
-- ##  0020_folgas.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0020: folgas (dias avulsos sem atendimento)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0018 e 0019. Pode rodar mais de uma vez.
--
-- "Dias de atendimento" é a SEMANA — vale para todas as segundas.
-- Folga é a EXCEÇÃO de um dia só: feriado, viagem, casamento.
-- São coisas diferentes e por isso moram em lugares diferentes;
-- desmarcar segunda pra fechar num feriado fecharia o mês inteiro.
--
-- Folga NÃO cancela quem já marcou. Ela fecha o dia para agendamento
-- NOVO; quem já está na agenda continua lá, e avisar é da dona.
-- Apagar agendamento por tabela seria decidir no lugar dela.
--
-- O banco de teste JÁ TINHA uma tabela `folgas` quando este arquivo
-- foi escrito. Por isso o `create table if not exists` não basta: ele
-- não repara uma tabela que já existe sem a restrição de unicidade ou
-- sem RLS. Os blocos DO abaixo acrescentam o que faltar, e não
-- fazem nada quando já está tudo lá.
-- ============================================================

create table if not exists public.folgas (
  id            uuid primary key default gen_random_uuid(),

  barbearia_id  uuid not null default auth.uid()
                  references public.barbearias(id) on delete cascade,

  data          date not null,

  criado_em     timestamptz not null default now(),

  -- Marcar o mesmo dia duas vezes é a mesma folga, não duas.
  constraint folga_unica_no_dia unique (barbearia_id, data)
);

comment on table public.folgas is
  'Dias avulsos em que a barbearia não abre. A semana fica em configuracao_agenda.';

-- Reparos para uma `folgas` criada antes desta migração.
do $$
begin
  -- Sem isto, marcar o mesmo dia duas vezes cria DUAS folgas, e o
  -- código que trata 23505 como "já era folga" nunca é acionado.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.folgas'::regclass
      and conname = 'folga_unica_no_dia'
  ) then
    alter table public.folgas
      add constraint folga_unica_no_dia unique (barbearia_id, data);
  end if;

  -- Sem a chave estrangeira, apagar a barbearia deixaria folga órfã.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.folgas'::regclass
      and contype = 'f'
      and conname = 'folgas_barbearia_id_fkey'
  ) then
    alter table public.folgas
      add constraint folgas_barbearia_id_fkey
      foreign key (barbearia_id) references public.barbearias(id)
      on delete cascade;
  end if;
end $$;

create index if not exists folgas_barbearia_data_idx
  on public.folgas (barbearia_id, data);

alter table public.folgas enable row level security;

drop policy if exists "folgas da propria barbearia" on public.folgas;
create policy "folgas da propria barbearia" on public.folgas
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ------------------------------------------------------------
-- agenda_publica — o dia pedido é folga?
--
-- Só um booleano do dia consultado. Devolver a lista de folgas do mês
-- seria contar pra fora quando a barbearia está vazia, e quem abre o
-- link não tem nada que fazer com isso.
-- ------------------------------------------------------------

create or replace function public.agenda_publica(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id    uuid;
  v_nome  text;
  v_cfg   record;
  v_folga boolean;
begin
  select b.id, b.nome into v_id, v_nome
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  select exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) into v_folga;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),
    'folga', v_folga,

    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00'),
      'porTurno', coalesce(v_cfg.por_turno, false),
      'manha', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.manha_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.manha_fecha, 'HH24:MI')
               ) else null end,
      'tarde', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.tarde_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.tarde_fecha, 'HH24:MI')
               ) else null end
    ),

    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'duracaoMin', s.duracao_min,
               'precoCentavos', s.preco_centavos,
               'ativo', true,
               'ordem', s.ordem
             ) order by s.ordem, s.nome)
      from public.servicos s
      where s.barbearia_id = v_id and s.ativo
    ), '[]'::jsonb),

    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome)
             order by b.nome)
      from public.barbeiros b
      where b.barbearia_id = v_id and b.ativo
    ), '[]'::jsonb),

    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'barbeiroId', a.barbeiro_id,
               'horario', to_char(a.horario, 'HH24:MI'),
               'duracaoMin', a.duracao_min
             ) order by a.horario)
      from public.agendamentos a
      where a.barbearia_id = v_id
        and a.data = p_data
        and a.estado <> 'cancelado'
        and a.barbeiro_id is not null
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------
-- criar_agendamento_publico — recusa folga
--
-- A checagem vem ANTES da do dia da semana: numa segunda de feriado as
-- duas valem, e "não abre nesse dia" é a resposta certa das duas.
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico(
  p_slug text,
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
  v_id      uuid;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_fim     time;
  v_ok      boolean := false;
  v_rotulo  text;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  v_nome := btrim(coalesce(p_cliente_nome, ''));
  if length(v_nome) < 2 or length(v_nome) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  select s.id, s.duracao_min, s.preco_centavos into v_servico
  from public.servicos s
  where s.id = p_servico_id and s.barbearia_id = v_id and s.ativo;

  if v_servico.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível. Escolha outro.');
  end if;

  if not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_id and b.ativo
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro indisponível. Escolha outro.');
  end if;

  if p_data < v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Essa data já passou.');
  end if;
  if p_data > v_hoje + 90 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para marcar com até 90 dias de antecedência.');
  end if;

  if exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não abre nesse dia. Escolha outra data.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);

  if not (extract(dow from p_data)::smallint = any (v_dias)) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não atende nesse dia.');
  end if;

  v_fim := p_horario + make_interval(mins => v_servico.duracao_min);

  if coalesce(v_cfg.por_turno, false) then
    if p_horario >= v_cfg.manha_abre and v_fim <= v_cfg.manha_fecha then
      v_ok := true;
    elsif p_horario >= v_cfg.tarde_abre and v_fim <= v_cfg.tarde_fecha then
      v_ok := true;
    end if;
    v_rotulo :=
      to_char(v_cfg.manha_abre, 'HH24:MI') || '–' || to_char(v_cfg.manha_fecha, 'HH24:MI') ||
      ', ' ||
      to_char(v_cfg.tarde_abre, 'HH24:MI') || '–' || to_char(v_cfg.tarde_fecha, 'HH24:MI');
  else
    v_ok := p_horario >= coalesce(v_cfg.abre, '09:00'::time)
        and v_fim <= coalesce(v_cfg.fecha, '19:00'::time);
    v_rotulo :=
      to_char(coalesce(v_cfg.abre, '09:00'::time), 'HH24:MI') || ' às ' ||
      to_char(coalesce(v_cfg.fecha, '19:00'::time), 'HH24:MI');
  end if;

  if not v_ok then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Fora do horário de atendimento (' || v_rotulo || ').'
    );
  end if;

  if extract(minute from p_horario)::int % 5 <> 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um horário fechado (de 5 em 5 minutos).');
  end if;

  begin
    insert into public.agendamentos (
      barbearia_id, barbeiro_id, cliente_nome, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_nome, v_servico.id,
      p_data, p_horario, 'agendado',
      v_servico.preco_centavos, v_servico.duracao_min,
      nullif(btrim(coalesce(p_observacao, '')), '')
    );
  exception
    when exclusion_violation then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse horário acabou de ser ocupado. Escolha outro.'
      );
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Dados inválidos para este agendamento.');
  end;

  return jsonb_build_object(
    'ok', true,
    'horario', to_char(p_horario, 'HH24:MI'),
    'data', p_data
  );
end $$;

-- ############################################################
-- ##  0021_cardapio_nasce_vazio.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0021: barbearia nova nasce SEM cardápio
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0005. Pode rodar mais de uma vez.
--
-- Até aqui toda conta nova ganhava Cabelo, Barba e Cabelo + Barba,
-- com preço e duração inventados por nós. Isso veio da 0003, quando os
-- serviços saíram de um enum fixo no código e precisavam continuar
-- aparecendo pra quem já usava o sistema — era migração de dado, não
-- decisão de produto.
--
-- Pedido do Gabriel: cardápio vazio. O preço de um corte é a coisa
-- mais particular de cada barbearia, e R$ 45,00 chutado por nós ou
-- vira o preço errado no primeiro agendamento, ou vira mais um item
-- pra apagar antes de começar.
--
-- O QUE CONTINUA sendo criado, e por quê:
--   - a linha em `barbearias`, com o apelido público (slug);
--   - a linha em `configuracao_agenda`, com o horário padrão.
-- Sem a configuração o calendário não sabe quando a loja abre e a tela
-- abre torta. Horário padrão é palpite corrigível; preço não é.
--
-- Não mexe em barbearia que já existe: quem já tem os três serviços
-- continua com eles.
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
begin
  -- Duas contas criadas no mesmo instante com o mesmo nome disputariam o
  -- apelido limpo, e a segunda quebraria o cadastro inteiro no índice único.
  -- O `exception` transforma essa corrida em apelido com sufixo.
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

  -- Aqui morava a semeadura de Cabelo / Barba / Cabelo + Barba.
  -- Saiu de propósito — ver o cabeçalho. Se algum dia voltar, que volte
  -- como uma ESCOLHA na tela de cadastro ("começar com um cardápio de
  -- exemplo?"), nunca como fato consumado no gatilho.

  return new;
end $$;

comment on function public.ao_criar_usuario() is
  'Conta nova ganha barbearia (com slug) e configuração de agenda. Cardápio nasce vazio — 0021.';

-- ############################################################
-- ##  0026_venda_espera_o_atendimento.sql
-- ############################################################

-- ============================================================
-- BARBOS — migração 0026: a compra lançada num atendimento só
--                          entra no caixa quando ele é concluído
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0009, 0011 e 0017. Pode rodar mais de uma vez.
--
-- ============================================================
-- O BUG QUE ISTO CONSERTA
-- ============================================================
--
-- Lançar um refrigerante na comanda de um agendamento gravava a venda
-- como 'confirmada' na hora. O dashboard soma `status = 'confirmada'`
-- sem olhar o agendamento, então o dinheiro aparecia no caixa com o
-- cliente ainda marcado como "Agendado" — antes de sentar na cadeira.
--
-- Pior: apagar o agendamento não tirava o dinheiro de lá. A coluna
-- `vendas.agendamento_id` era `on delete set null`, e venda com
-- agendamento nulo é exatamente como uma compra AVULSA se parece. A
-- venda pendurada num atendimento que foi apagado virava, sozinha,
-- receita de balcão.
--
-- ============================================================
-- A REGRA NOVA — e por que ela é derivada, não gravada
-- ============================================================
--
--   venda avulsa (agendamento_id null)  → entra no caixa na hora
--   venda de um atendimento             → entra quando ele conclui
--
-- A tentação era criar um status 'pendente' e virar pra 'confirmada'
-- num gatilho do "Concluir". Não foi feito assim: status gravado
-- DESANDA. Basta o barbeiro concluir sem querer e voltar o estado pra
-- 'agendado' que a venda fica 'confirmada' pra sempre, contando um
-- dinheiro que a agenda diz que não entrou — e ninguém percebe, porque
-- o número está certo em um lugar e errado no outro.
--
-- Aqui só existe uma fonte da verdade: o estado do agendamento. A view
-- `vendas_no_caixa` faz a pergunta na hora de somar. Concluir passa a
-- contar, desconcluir para de contar, e não há nada pra ficar fora de
-- sincronia porque não há nada duplicado.
--
-- ============================================================
-- O QUE MUDA NOS NÚMEROS QUE VOCÊ JÁ TEM
-- ============================================================
--
-- Toda venda hoje pendurada num agendamento NÃO concluído sai do
-- balanço na hora em que esta migração roda. Ela volta assim que o
-- atendimento for concluído. Venda avulsa não se mexe.
--
-- Para ver antes de rodar quanto vai sair do caixa:
--
--   select count(*) as vendas,
--          sum(v.total_centavos) / 100.0 as reais
--   from public.vendas v
--   join public.agendamentos a on a.id = v.agendamento_id
--   where v.status = 'confirmada'
--     and a.estado <> 'concluido';
--
-- O MÊS da venda continua sendo o de `criado_em` (quando foi lançada),
-- não o da conclusão. Concluir hoje um atendimento de ontem faz o
-- número de ONTEM crescer, e é o certo: o refrigerante saiu ontem.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A regra, num lugar só
-- ------------------------------------------------------------
-- Uma view e não uma condição repetida: `resumo_dashboard` soma vendas
-- em SEIS lugares (cartão, pizza de produtos, série de meses, e as
-- variantes com filtro de produto). Seis cópias da mesma regra é como
-- se descobre, meses depois, que uma delas não foi atualizada junto.
--
-- `security_invoker = on`: a view lê com o RLS de quem chamou, não com
-- o de quem a criou. Sem isso ela seria um buraco por onde uma
-- barbearia leria a venda da outra.

create or replace view public.vendas_no_caixa
with (security_invoker = on) as
select v.*
from public.vendas v
where v.status = 'confirmada'
  and (
    -- Compra avulsa: ninguém precisa concluir nada. É o balcão, é para
    -- isso que a loja do QR existe.
    v.agendamento_id is null
    or exists (
      select 1
      from public.agendamentos a
      where a.id = v.agendamento_id
        and a.estado = 'concluido'
    )
  );

comment on view public.vendas_no_caixa is
  'As vendas que contam como receita: avulsas, e as de atendimento concluído. Regra única do caixa.';

-- Só a dona logada. `anon` fica de fora de propósito: a loja pública
-- não soma caixa nenhum, e o faturamento da barbearia não tem por que
-- estar ao alcance de quem só leu o QR code.
revoke all on public.vendas_no_caixa from public;
grant select on public.vendas_no_caixa to authenticated;


-- ------------------------------------------------------------
-- 2. Apagar o agendamento não pode deixar a venda solta
-- ------------------------------------------------------------
-- `on delete set null` era o contrário do que se queria: apagava a
-- ligação e deixava a venda com cara de avulsa, que é justamente a que
-- conta sem perguntar nada. O caminho normal (o botão Excluir) nem
-- chega aqui — a função da parte 3 apaga as vendas antes. Isto é a
-- rede de baixo, para quando alguém apagar a linha direto no painel do
-- Supabase: melhor a venda sumir junto do que virar receita fantasma.

alter table public.vendas
  drop constraint if exists vendas_agendamento_id_fkey;

alter table public.vendas
  add constraint vendas_agendamento_id_fkey
    foreign key (agendamento_id)
    references public.agendamentos(id)
    on delete cascade;

comment on column public.vendas.agendamento_id is
  'Agendamento a que a compra foi lançada. Nulo = compra avulsa (balcão). Apagar o agendamento apaga a venda.';


-- ------------------------------------------------------------
-- 3. Excluir agendamento: devolve o consumo à prateleira
-- ------------------------------------------------------------
-- Excluir é diferente de cancelar. Cancelar (`estado = 'cancelado'`)
-- guarda a linha, porque "fulano desmarcou" é fato do negócio. Excluir
-- diz "isto nunca deveria ter existido" — e então o que foi lançado
-- dentro dele também não existiu: as unidades voltam pro estoque e as
-- vendas somem.
--
-- Tudo numa função só porque são três escritas que precisam cair
-- juntas. Em três chamadas separadas, uma falha no meio deixaria o
-- estoque contando unidades que ninguém tirou da prateleira.
--
-- `security definer`: `vendas` e `itens_venda` só têm política de
-- SELECT (0007). Como invoker, o delete não daria erro — apagaria
-- ZERO linhas em silêncio, que é o pior resultado possível. Por isso o
-- dono é conferido na mão, logo abaixo.

create or replace function public.excluir_agendamento(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia  uuid;
  v_unidades   bigint := 0;
  v_centavos   bigint := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sua sessão expirou. Entre de novo.');
  end if;

  -- `for update` segura a linha: sem isso, um "Concluir" disparado do
  -- celular no mesmo segundo poderia entrar entre a devolução do
  -- estoque e o delete.
  select a.barbearia_id into v_barbearia
  from public.agendamentos a
  where a.id = p_id
  for update;

  if v_barbearia is null then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento já não existe. Recarregue a página.');
  end if;

  if v_barbearia <> auth.uid() then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento não é desta barbearia.');
  end if;

  -- Quanto vai voltar. Serve para a mensagem na tela e para pular o
  -- update quando não houve consumo nenhum.
  select coalesce(sum(i.quantidade), 0),
         coalesce(sum(i.preco_centavos * i.quantidade), 0)
  into v_unidades, v_centavos
  from public.itens_venda i
  join public.vendas v on v.id = i.venda_id
  where v.agendamento_id = p_id
    and v.barbearia_id = v_barbearia;

  if v_unidades > 0 then
    -- O `group by` não é enfeite: o mesmo produto pode ter sido lançado
    -- em duas vendas do mesmo atendimento (cada lançamento vira uma
    -- venda, ver 0011). Sem agrupar, o UPDATE ... FROM casaria duas
    -- linhas com a mesma linha de `produtos` e o Postgres aplicaria só
    -- UMA delas — o segundo refrigerante nunca voltaria à prateleira.
    update public.produtos p
    set unidades = p.unidades + d.quantidade
    from (
      select i.produto_id, sum(i.quantidade) as quantidade
      from public.itens_venda i
      join public.vendas v on v.id = i.venda_id
      where v.agendamento_id = p_id
        and v.barbearia_id = v_barbearia
      group by i.produto_id
    ) d
    where p.id = d.produto_id
      and p.barbearia_id = v_barbearia;
  end if;

  -- As vendas do atendimento. `itens_venda` desce junto por cascade
  -- (0007). O cascade da parte 2 faria isso sozinho no delete abaixo,
  -- mas apagar aqui deixa a ordem explícita para quem for ler depois.
  delete from public.vendas
  where agendamento_id = p_id
    and barbearia_id = v_barbearia;

  delete from public.agendamentos
  where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'unidadesDevolvidas', v_unidades,
    'centavosDevolvidos', v_centavos
  );
end $$;

comment on function public.excluir_agendamento is
  'Apaga o agendamento, apaga as vendas lançadas nele e devolve as unidades ao estoque. Tudo ou nada.';

revoke all on function public.excluir_agendamento(uuid) from public;
grant execute on function public.excluir_agendamento(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. O dashboard passa a ler pela view
-- ------------------------------------------------------------
-- Mesma assinatura e mesmo corpo da 0017. A ÚNICA diferença: onde
-- estava `from public.vendas v where v.status = 'confirmada'` agora
-- está `from public.vendas_no_caixa v` — a view já carrega o status e
-- a regra do atendimento concluído.

create or replace function public.resumo_dashboard(
  p_inicio date,
  p_fim date,
  p_servico_ids uuid[] default null,
  p_barbeiro_ids uuid[] default null,
  p_produto_ids uuid[] default null,
  p_so_loja boolean default false
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint := 0;
  v_atendimentos     bigint := 0;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb := '[]'::jsonb;
  v_produtos jsonb;
  v_meses    jsonb;

  v_filtra_servico  boolean;
  v_filtra_barbeiro boolean;
  v_filtra_produto  boolean;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;
  v_filtra_produto := p_produto_ids is not null and cardinality(p_produto_ids) > 0;

  if not coalesce(p_so_loja, false) then
    select coalesce(sum(a.preco_centavos), 0), count(*)
    into v_servico_centavos, v_atendimentos
    from public.agendamentos a
    where a.estado = 'concluido'
      and a.data >= p_inicio
      and a.data < p_fim
      and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
      and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids));
  end if;

  -- Com filtro de produto: soma as LINHAS, não o total da venda inteira.
  if v_filtra_produto then
    select coalesce(sum(i.preco_centavos * i.quantidade), 0),
           count(distinct v.id)
    into v_loja_centavos, v_vendas
    from public.itens_venda i
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and i.produto_id = any (p_produto_ids)
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas_no_caixa v
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
  end if;

  if not coalesce(p_so_loja, false) then
    select coalesce(jsonb_agg(linha order by (linha->>'totalCentavos')::bigint desc), '[]'::jsonb)
    into v_servicos
    from (
      select jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'quantidade', count(*),
               'totalCentavos', coalesce(sum(a.preco_centavos), 0)
             ) as linha
      from public.agendamentos a
      join public.servicos s on s.id = a.servico_id
      where a.estado = 'concluido'
        and a.data >= p_inicio
        and a.data < p_fim
        and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
        and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
      group by s.id, s.nome, s.cor
    ) t;
  end if;

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      )
    group by i.nome
  ) t;

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas_no_caixa v)
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      date_trunc('month', p_inicio)::date
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select coalesce(sum(a.preco_centavos), 0)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end,
               'lojaCentavos', case
                 when v_filtra_produto then (
                   select coalesce(sum(i.preco_centavos * i.quantidade), 0)
                   from public.itens_venda i
                   join public.vendas_no_caixa v on v.id = i.venda_id
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas_no_caixa v
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
                 )
               end,
               'atendimentos', case
                 when coalesce(p_so_loja, false) then 0
                 else (
                   select count(*)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end
             ) as linha
      from (
        select generate_series(
                 date_trunc('month', v_primeiro)::date,
                 v_ultimo,
                 interval '1 month'
               )::date as mes
      ) m
    ) t;
  end if;

  return jsonb_build_object(
    'mes', to_char(p_inicio, 'YYYY-MM'),
    'inicio', p_inicio,
    'fim', p_fim,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', coalesce(v_produtos, '[]'::jsonb),
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Números do dashboard no intervalo [inicio, fim). Loja conta pela view vendas_no_caixa: avulsa entra na hora, a de atendimento entra quando ele conclui.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;


-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   -- as que estão esperando um atendimento concluir:
--   select a.cliente_nome, a.data, a.estado, v.total_centavos / 100.0 as reais
--   from public.vendas v
--   join public.agendamentos a on a.id = v.agendamento_id
--   where v.status = 'confirmada'
--     and a.estado <> 'concluido'
--   order by a.data;
--
--   -- e o que o caixa enxerga (não pode conter nenhuma das de cima):
--   select count(*), sum(total_centavos) / 100.0 as reais
--   from public.vendas_no_caixa;
--
-- Depois, no sistema: lance um produto num agendamento "Agendado" e
-- veja o dashboard NÃO mexer. Toque em Concluir e veja o valor entrar.
-- ------------------------------------------------------------

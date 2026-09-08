-- ============================================================
-- BARBOS — migração 0024: catálogo único de nomes
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0003 e 0004. Pode rodar mais de uma vez.
--
-- O PEDIDO: "CABELO" não pode existir várias vezes no banco. Quando
-- a barbearia X cadastra um serviço com nome que já existe, o sistema
-- reconhece, não cria o nome de novo, e ATRIBUI aquele nome à X.
--
-- COMO FICA:
--   nomes_de_servico / nomes_de_produto  = o catálogo. UMA linha por
--     nome distinto, no banco inteiro. É aqui que "CABELO" mora, uma
--     vez só.
--   servicos / produtos  = continuam com uma linha POR BARBEARIA,
--     apontando pro catálogo por `nome_id`. Isso é obrigatório: preço,
--     duração, cor e ordem são de cada barbearia. Duas barbearias
--     cobram valores diferentes pelo mesmo "CABELO".
--
-- Ou seja: 3 barbearias com CABELO = 3 linhas em `servicos` (os
-- preços delas) + 1 linha em `nomes_de_servico` (o nome).
--
-- ============================================================
-- DUAS CONSEQUÊNCIAS QUE VOCÊ PRECISA SABER
-- ============================================================
--
-- 1. A GRAFIA PASSA A SER DE QUEM CHEGOU PRIMEIRO.
--    Se a gabriel-teste cadastrou "CABELO" e a barbearia X digita
--    "Cabelo", a X vai ver "CABELO" no cardápio dela — é a mesma
--    linha de catálogo. Isso é o preço de compartilhar o nome; não
--    tem como ter as duas coisas.
--
-- 2. O CATÁLOGO É SÓ-ESCRITA-UMA-VEZ.
--    Renomear uma linha do catálogo renomeia pra TODAS as barbearias
--    de uma vez. Por isso ninguém renomeia: trocar o nome de um
--    serviço faz ele apontar pra OUTRA linha do catálogo (criada se
--    não existir). A política de RLS abaixo permite `select` e
--    `insert`, e nega `update` e `delete` de propósito.
--
-- ============================================================
-- O QUE ESTA MIGRAÇÃO **NÃO** FAZ (e por quê)
-- ============================================================
--
-- Ela mantém a coluna `servicos.nome` / `produtos.nome`, agora como
-- espelho preenchido pelo gatilho com a grafia canônica do catálogo.
--
-- Tirar a coluna exige reescrever SETE funções do banco
-- (`agenda_publica`, `resumo_dashboard`, `ajustar_comanda`,
-- `confirmar_compra_loja`, as do carrinho da 0012,
-- `clientes_do_dia_loja`) mais a view `loja_produtos` e a camada
-- TypeScript inteira. É a etapa 2, e ela precisa de login funcionando
-- pra ser testada de verdade — coisa que não dá pra fazer com o banco
-- recém-limpo. Fazer no escuro, agora, arriscaria derrubar a agenda,
-- a loja e o dashboard de uma vez.
--
-- O que você pediu — nome único, reconhecido e atribuído — está
-- inteiro aqui. O que falta é remover uma coluna espelho.
-- ============================================================


-- ============================================================
-- 1. Normalização — o que conta como "o mesmo nome"
-- ============================================================
--
-- "CABELO", "Cabelo", " cabelo  " e "Cabeló" são o mesmo nome. Sem
-- isso a deduplicação não acontece: bastaria alguém digitar em caixa
-- baixa pra nascer uma segunda linha de catálogo.
--
-- Sem a extensão `unaccent` de propósito: `translate` resolve o
-- português inteiro, é `immutable` sem depender de configuração do
-- projeto, e serve de índice único.

create or replace function public.normalizar_nome(p_texto text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(
    lower(
      translate(
        btrim(p_texto),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      )
    ),
    '\s+', ' ', 'g'
  )
$$;

comment on function public.normalizar_nome(text) is
  'Chave de comparação de nomes: sem acento, minúsculo, espaços colapsados.';


-- ============================================================
-- 2. Os catálogos
-- ============================================================

create table if not exists public.nomes_de_servico (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 1 and 60),
  chave     text not null,
  criado_em timestamptz not null default now(),

  constraint nome_de_servico_unico unique (chave)
);

create table if not exists public.nomes_de_produto (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null check (length(btrim(nome)) between 1 and 60),
  chave     text not null,
  criado_em timestamptz not null default now(),

  constraint nome_de_produto_unico unique (chave)
);

comment on table public.nomes_de_servico is
  'Catálogo global de nomes de serviço. Uma linha por nome. Nunca renomear: a linha é de todas as barbearias.';
comment on table public.nomes_de_produto is
  'Catálogo global de nomes de produto. Uma linha por nome. Nunca renomear: a linha é de todas as barbearias.';

-- A chave sai do nome, sempre. Gatilho e não coluna gerada: coluna
-- gerada prende a função `normalizar_nome`, e uma correção nela
-- (um acento esquecido) viraria uma migração travada.
create or replace function public.preencher_chave_do_nome()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome  := btrim(new.nome);
  new.chave := public.normalizar_nome(new.nome);
  return new;
end $$;

drop trigger if exists chave_do_nome_servico on public.nomes_de_servico;
create trigger chave_do_nome_servico
  before insert or update on public.nomes_de_servico
  for each row execute function public.preencher_chave_do_nome();

drop trigger if exists chave_do_nome_produto on public.nomes_de_produto;
create trigger chave_do_nome_produto
  before insert or update on public.nomes_de_produto
  for each row execute function public.preencher_chave_do_nome();


-- ============================================================
-- 3. RLS do catálogo
-- ============================================================
--
-- Lê quem está logado; escreve ninguém direto. Quem insere é a função
-- `nome_de_servico_id` / `nome_de_produto_id`, que é `security
-- definer` — assim o catálogo cresce só pelo caminho controlado.
--
-- `update` e `delete` NÃO têm política, então são negados: a linha é
-- compartilhada, e renomear afetaria todas as barbearias de uma vez.
--
-- Só `authenticated`: `anon` não precisa. As telas públicas leem por
-- funções `security definer` e por views com direito de dono, que
-- passam por cima do RLS de qualquer jeito. Deixar o catálogo aberto
-- ao público entregaria a lista de todo nome de serviço já cadastrado
-- no sistema, de graça.

alter table public.nomes_de_servico enable row level security;
alter table public.nomes_de_produto enable row level security;

drop policy if exists "catalogo de servico é de leitura" on public.nomes_de_servico;
create policy "catalogo de servico é de leitura" on public.nomes_de_servico
  for select to authenticated using (true);

drop policy if exists "catalogo de produto é de leitura" on public.nomes_de_produto;
create policy "catalogo de produto é de leitura" on public.nomes_de_produto
  for select to authenticated using (true);


-- ============================================================
-- 4. Achar-ou-criar — o coração do pedido
-- ============================================================
--
-- "o sistema identifica que o nome é igual e não cadastra novamente,
-- porém atribui à nova barbearia". É isto: devolve o id existente
-- quando o nome já é conhecido, e só cria linha nova quando ninguém
-- no sistema tinha aquele nome ainda.
--
-- O `on conflict` cobre a corrida de duas barbearias cadastrando
-- "CABELO" no mesmo segundo — sem ele, a segunda levaria erro de
-- chave duplicada em vez de receber o id que acabou de nascer.

create or replace function public.nome_de_servico_id(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := public.normalizar_nome(p_nome);
  v_id    uuid;
begin
  if v_chave is null or v_chave = '' then
    raise exception 'BARBOS: nome de serviço vazio.';
  end if;

  select id into v_id from public.nomes_de_servico where chave = v_chave;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.nomes_de_servico (nome, chave)
  values (btrim(p_nome), v_chave)
  on conflict (chave) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.nomes_de_servico where chave = v_chave;
  end if;

  return v_id;
end $$;

create or replace function public.nome_de_produto_id(p_nome text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_chave text := public.normalizar_nome(p_nome);
  v_id    uuid;
begin
  if v_chave is null or v_chave = '' then
    raise exception 'BARBOS: nome de produto vazio.';
  end if;

  select id into v_id from public.nomes_de_produto where chave = v_chave;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.nomes_de_produto (nome, chave)
  values (btrim(p_nome), v_chave)
  on conflict (chave) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.nomes_de_produto where chave = v_chave;
  end if;

  return v_id;
end $$;


-- ============================================================
-- 5. A ligação
-- ============================================================

alter table public.servicos
  add column if not exists nome_id uuid references public.nomes_de_servico(id);

alter table public.produtos
  add column if not exists nome_id uuid references public.nomes_de_produto(id);

-- Backfill: cada nome que já existe entra no catálogo uma vez só.
update public.servicos s
set nome_id = public.nome_de_servico_id(s.nome)
where s.nome_id is null;

update public.produtos p
set nome_id = public.nome_de_produto_id(p.nome)
where p.nome_id is null;

-- `not null` só depois do backfill, e só se ele deu certo — falhar
-- aqui é melhor que uma coluna meio preenchida passando batida.
do $$
begin
  if exists (select 1 from public.servicos where nome_id is null) then
    raise exception 'BARBOS: sobrou serviço sem nome_id. Não aplico o NOT NULL.';
  end if;
  if exists (select 1 from public.produtos where nome_id is null) then
    raise exception 'BARBOS: sobrou produto sem nome_id. Não aplico o NOT NULL.';
  end if;

  alter table public.servicos alter column nome_id set not null;
  alter table public.produtos alter column nome_id set not null;
end $$;


-- ============================================================
-- 6. O gatilho que faz tudo acontecer sozinho
-- ============================================================
--
-- É aqui que o pedido vira comportamento: o app continua mandando
-- `nome` como texto, e o banco resolve. Nenhuma linha de TypeScript
-- precisou mudar pra isto funcionar.
--
-- Ele também REESCREVE `nome` com a grafia do catálogo. É o item 1
-- das consequências lá em cima: quem chegou primeiro define a grafia.

create or replace function public.resolver_nome_do_servico()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome_id := public.nome_de_servico_id(new.nome);
  new.nome    := (select nome from public.nomes_de_servico where id = new.nome_id);
  return new;
end $$;

create or replace function public.resolver_nome_do_produto()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.nome_id := public.nome_de_produto_id(new.nome);
  new.nome    := (select nome from public.nomes_de_produto where id = new.nome_id);
  return new;
end $$;

drop trigger if exists resolver_nome_servico on public.servicos;
create trigger resolver_nome_servico
  before insert or update of nome on public.servicos
  for each row execute function public.resolver_nome_do_servico();

drop trigger if exists resolver_nome_produto on public.produtos;
create trigger resolver_nome_produto
  before insert or update of nome on public.produtos
  for each row execute function public.resolver_nome_do_produto();


-- ============================================================
-- 7. Unicidade dentro da barbearia, agora por nome_id
-- ============================================================
--
-- Os índices antigos comparavam `lower(trim(nome))`. Passam a
-- comparar o id do catálogo, que já carrega acento e caixa
-- resolvidos: "Cabelo" e "CABELO" deixam de escapar um do outro.
--
-- Os antigos ficam: são equivalentes agora que o gatilho canoniza o
-- texto, e derrubá-los sem necessidade só aumenta a superfície da
-- migração.

create unique index if not exists servicos_nome_id_ativo_unico
  on public.servicos (barbearia_id, nome_id)
  where ativo;

-- Produto repete nome entre tipos de propósito: "Água" pode existir
-- na mercearia e no salão. Por isso o tipo entra na chave.
create unique index if not exists produtos_nome_id_tipo_unico
  on public.produtos (barbearia_id, tipo, nome_id);


-- ============================================================
-- 8. Conferir depois de rodar
-- ============================================================
--
--   -- quantas vezes cada nome aparece no catálogo (tem que ser 1)
--   select nome, count(*) from public.nomes_de_servico
--   group by nome having count(*) > 1;
--
--   -- o catálogo e quem usa cada nome
--   select n.nome, count(s.id) as barbearias
--   from public.nomes_de_servico n
--   left join public.servicos s on s.nome_id = n.id
--   group by n.nome
--   order by n.nome;
-- ============================================================

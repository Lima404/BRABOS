-- ============================================================
-- BARBOS — limpar 100% do banco
--
-- NÃO é migração. Operação manual, destrutiva, sem desfazer.
-- Rodar em: Supabase → SQL Editor → New query.
--
-- ============================================================
-- LEIA ISTO ANTES DE COLAR
-- ============================================================
--
-- Isto apaga TODOS os dados de TODAS as barbearias, incluindo a
-- "Gabriel Teste", e TODAS as contas de login. Não sobra nada:
-- agenda, cardápio, equipe, estoque, vendas, folgas e usuários.
--
-- O ESQUEMA FICA. Tabelas, funções, gatilhos, políticas de RLS e
-- as views públicas continuam de pé — nenhuma migração precisa ser
-- rodada de novo depois. O que some é o conteúdo.
--
-- O QUE MUDA PRA VOCÊ, NA PRÁTICA:
--
--   1. Você vai ser deslogado e o seu e-mail volta a ficar livre.
--      Pra voltar a usar o sistema, cadastre de novo em /cadastrar.
--   2. `BARBOS_EMAIL_TESTE` / `BARBOS_SENHA_TESTE` no `.env.local`
--      param de funcionar até você recriar a conta. Se recriar com
--      o MESMO e-mail e a MESMA senha, voltam a valer sozinhos.
--   3. Com a migração 0021 aplicada, a conta nova nasce SEM
--      cardápio — o que é justamente o estado que você quer ver.
--   4. Se "Confirm email" estiver ligado no painel, o cadastro novo
--      vai pedir o link do e-mail.
--
-- Depois disto, a migração 0022 (que apagava duas barbearias por id)
-- não tem mais o que fazer. Pode deixar: rodar de novo não faz nada.
-- ============================================================

-- ============================================================
-- PASSO 1 — ver o que vai embora
-- ============================================================
-- Rode só este select primeiro. É a última chance de olhar o
-- tamanho do que está sendo apagado.

select 'barbearias'          as tabela, count(*) from public.barbearias
union all select 'contas de login',       count(*) from auth.users
union all select 'agendamentos',          count(*) from public.agendamentos
union all select 'servicos',              count(*) from public.servicos
union all select 'barbeiros',             count(*) from public.barbeiros
union all select 'produtos',              count(*) from public.produtos
union all select 'vendas',                count(*) from public.vendas
union all select 'itens_venda',           count(*) from public.itens_venda
union all select 'folgas',                count(*) from public.folgas
union all select 'configuracao_agenda',   count(*) from public.configuracao_agenda;

-- ============================================================
-- PASSO 2 — limpar
-- ============================================================
-- A trava: enquanto `v_confirmo` for false, rodar este bloco não
-- apaga nada. Troque para `true` de propósito, com a mão.
--
-- Isso existe porque um Ctrl+A / Run distraído no SQL Editor apaga
-- o banco inteiro em silêncio, e não tem lixeira.

do $$
declare
  v_confirmo constant boolean := false;  -- <<< troque para true
  v_contas   int;
begin
  if not v_confirmo then
    raise exception
      'BARBOS: nada foi apagado. Para limpar o banco, mude v_confirmo para true.';
  end if;

  -- 1. Todas as tabelas do app num TRUNCATE só.
  --
  --    Uma lista única e não um delete por tabela: o Postgres aceita
  --    esvaziar um grupo de tabelas com chaves entre si desde que
  --    TODAS estejam na lista, e aí a ordem deixa de importar. É por
  --    isso que os três `on delete restrict` (itens_venda->produtos,
  --    agendamentos->servicos, agendamentos->barbeiros) não travam
  --    aqui como travam num delete solto.
  truncate table
    public.itens_venda,
    public.vendas,
    public.agendamentos,
    public.folgas,
    public.servicos,
    public.barbeiros,
    public.produtos,
    public.configuracao_agenda,
    public.barbearias;

  -- 2. As contas de login. Vem DEPOIS de propósito: `barbearias.id`
  --    referencia `auth.users(id)` com cascade, e se estas saíssem
  --    primeiro o cascata desceria pelas tabelas cheias e bateria nos
  --    `restrict` — o mesmo erro do botão de delete do painel.
  --
  --    `delete` e não `truncate`: as tabelas internas do Auth
  --    (identities, sessions, refresh_tokens…) penduram em
  --    `auth.users` com cascade, e o delete leva todas junto.
  delete from auth.users;
  get diagnostics v_contas = row_count;

  raise notice 'BARBOS: banco limpo. % conta(s) de login apagada(s).', v_contas;
end $$;

-- ============================================================
-- PASSO 3 — conferir
-- ============================================================
-- Rode o select do passo 1 de novo: TODAS as contagens têm que
-- estar em 0. Confira também Authentication → Users, que precisa
-- estar vazio.
--
-- Depois: abra /cadastrar e crie a conta de novo. A barbearia nasce
-- com o horário padrão, o apelido público, e o cardápio vazio.

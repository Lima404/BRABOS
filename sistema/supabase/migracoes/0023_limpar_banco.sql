-- ============================================================
-- BARBOS — migração 0023: limpar 100% do banco
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0020.
--
-- ============================================================
-- ESTA MIGRAÇÃO NASCE DESARMADA — E TEM QUE CONTINUAR ASSIM
-- ============================================================
--
-- Arquivo em `migracoes/` é feito pra ser rodado de novo, em ordem,
-- em qualquer banco. Se este apagasse dado ao ser executado, um dia
-- alguém replicaria as migrações num ambiente com dado de verdade e
-- zeraria tudo sem querer.
--
-- Por isso a variável `v_confirmo` nasce `false` e o bloco RECUSA.
-- Do jeito que está no git, rodar esta migração não apaga nada.
-- Quem limpa é você, trocando para `true` com a mão, na hora.
--
-- **Não comite o arquivo com `true`.** Se precisar limpar de novo
-- depois, troque de novo — o incômodo é o recurso.
--
-- ============================================================
-- O QUE ELA APAGA
-- ============================================================
--
-- Todos os dados de TODAS as barbearias (inclusive a "Gabriel
-- Teste") e TODAS as contas de login: agenda, cardápio, equipe,
-- estoque, vendas, folgas, configuração e usuários.
--
-- O ESQUEMA FICA. Tabelas, funções, gatilhos, políticas de RLS e as
-- views públicas continuam de pé — nenhuma outra migração precisa
-- ser rodada de novo depois. O que some é o conteúdo.
--
-- ============================================================
-- O QUE MUDA PRA VOCÊ, NA PRÁTICA
-- ============================================================
--
--   1. Você é deslogado e o seu e-mail volta a ficar livre. Para
--      usar o sistema, cadastre de novo em /cadastrar.
--   2. `BARBOS_EMAIL_TESTE` / `BARBOS_SENHA_TESTE` do `.env.local`
--      param de funcionar até a conta ser recriada. Recriando com o
--      MESMO e-mail e a MESMA senha, voltam a valer sozinhos.
--   3. Rode a 0021 ANTES desta. Sem ela, o gatilho de conta nova
--      ainda semeia Cabelo / Barba / Cabelo + Barba, e a conta que
--      você criar depois da limpeza já vem com cardápio.
--   4. Se "Confirm email" estiver ligado no painel, o cadastro novo
--      vai pedir o link do e-mail.
--
-- Depois desta, a 0022 (que apagava duas barbearias por id) não tem
-- mais o que fazer. Rodar de novo não faz nada.
-- ============================================================

-- ------------------------------------------------------------
-- ANTES: veja o tamanho do que vai embora.
-- Rode este select sozinho primeiro.
--
--   select 'barbearias'        as tabela, count(*) from public.barbearias
--   union all select 'contas de login',     count(*) from auth.users
--   union all select 'agendamentos',        count(*) from public.agendamentos
--   union all select 'servicos',            count(*) from public.servicos
--   union all select 'barbeiros',           count(*) from public.barbeiros
--   union all select 'produtos',            count(*) from public.produtos
--   union all select 'vendas',              count(*) from public.vendas
--   union all select 'itens_venda',         count(*) from public.itens_venda
--   union all select 'folgas',              count(*) from public.folgas
--   union all select 'configuracao_agenda', count(*) from public.configuracao_agenda;
-- ------------------------------------------------------------

do $$
declare
  -- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  -- TROQUE PARA true PARA LIMPAR. É a única linha que você mexe.
  -- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  v_confirmo constant boolean := false;

  v_contas int;
begin
  if not v_confirmo then
    raise notice
      'BARBOS: migração 0023 está desarmada — nada foi apagado. Para limpar o banco, troque v_confirmo para true e rode de novo.';
    return;
  end if;

  -- 1. Todas as tabelas do app num TRUNCATE só.
  --
  --    Uma lista única, e não um delete por tabela: o Postgres aceita
  --    esvaziar um grupo de tabelas com chaves entre si desde que
  --    TODAS estejam na lista, e aí a ordem deixa de importar. É por
  --    isso que os três `on delete restrict` (itens_venda->produtos,
  --    agendamentos->servicos, agendamentos->barbeiros) não travam
  --    aqui como travam no botão de delete do painel.
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

  -- 2. As contas de login, DEPOIS das tabelas. `barbearias.id`
  --    referencia `auth.users(id)` com cascade (0001): se estas
  --    saíssem primeiro, o cascata desceria pelas tabelas ainda
  --    cheias e bateria nos `restrict` — o mesmo erro do painel.
  --
  --    `delete` e não `truncate`: as tabelas internas do Auth
  --    (identities, sessions, refresh_tokens…) penduram em
  --    `auth.users` com cascade, e o delete leva todas junto.
  delete from auth.users;
  get diagnostics v_contas = row_count;

  raise notice 'BARBOS: banco limpo. % conta(s) de login apagada(s).', v_contas;
end $$;

-- ------------------------------------------------------------
-- DEPOIS: rode o select de novo — todas as contagens em 0, e
-- Authentication → Users vazio. Então abra /cadastrar e crie a
-- conta. A barbearia nasce com horário padrão, apelido público e
-- (com a 0021 aplicada) cardápio vazio.
-- ------------------------------------------------------------

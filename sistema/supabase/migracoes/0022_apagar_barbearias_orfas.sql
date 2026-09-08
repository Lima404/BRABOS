-- ============================================================
-- BARBOS — migração 0022: apagar barbearias órfãs
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0020. Pode rodar mais de uma vez (na segunda não
-- acha mais nada e não faz nada).
--
-- ATENÇÃO — esta migração é diferente de todas as outras: ela não
-- muda ESQUEMA, ela apaga DADO, e apaga de vez. Foi pedida assim.
-- A ferramenta reutilizável, com o passo de conferência antes,
-- está em `supabase/manutencao/apagar-barbearia.sql`; use aquela
-- para as próximas limpezas, e não copie esta.
--
-- Como ela é uma lista de ids fixos, rodar num banco que não tenha
-- esses ids não faz nada — que é o comportamento certo para um
-- arquivo que fica no histórico.
--
-- ============================================================
-- POR QUE O DELETE DA TELA FALHA
-- ============================================================
--
-- Apagar a linha de `barbearias` dispara o cascata dos filhos, e três
-- chaves `on delete restrict` travam no meio:
--
--   itens_venda.produto_id   -> produtos   (0007)
--   agendamentos.servico_id  -> servicos   (0003)
--   agendamentos.barbeiro_id -> barbeiros  (0015)
--
-- O painel do Supabase sugere trocar essas chaves por cascade. NÃO.
-- Elas existem para que apagar um produto ou um serviço nunca leve
-- junto o histórico de quem foi atendido e do que foi vendido —
-- abrir esse buraco no app inteiro para economizar uma limpeza que
-- acontece uma vez por ano é um péssimo negócio.
--
-- A saída é apagar na ORDEM, de baixo pra cima.
-- ============================================================

do $$
declare
  -- ------------------------------------------------------------
  -- AS BARBEARIAS QUE SAEM
  --
  -- Estas duas foram conferidas pelo apelido público antes de entrar
  -- aqui. Para incluir outra, rode o select do PASSO 1 de
  -- `manutencao/apagar-barbearia.sql`, confira nome e e-mail, e
  -- acrescente o id na lista.
  -- ------------------------------------------------------------
  v_ids uuid[] := array[
    'b2dbb695-00f9-4657-b18d-71b8697b59aa',  -- barber-leo    (BARBER LEO)
    '8fa6cc72-bc99-4ff2-a327-fad6126b24a1'   -- barber-tonho  (BARBER TONHO)
  ]::uuid[];

  -- A barbearia de trabalho nunca sai por aqui: é onde tudo é testado
  -- (ver AGENTS.md), e recriar cardápio, equipe e estoque à mão custa
  -- uma tarde. A trava é pelo APELIDO e não pelo nome — já houve DUAS
  -- barbearias chamadas "Gabriel Teste" ao mesmo tempo, e a órfã era
  -- justamente uma delas.
  v_protegida constant text := 'gabriel-teste';

  v_alvo  record;
  v_quant int := 0;
begin
  if exists (
    select 1 from public.barbearias
    where id = any(v_ids) and slug = v_protegida
  ) then
    raise exception
      'BARBOS: a lista inclui a barbearia de trabalho (%). Tire o id dela.',
      v_protegida;
  end if;

  for v_alvo in
    select b.id, b.nome, b.slug
    from public.barbearias b
    where b.id = any(v_ids)
  loop
    -- 1. itens da venda — são eles que referenciam `produtos` com
    --    restrict, e por isso morrem primeiro.
    delete from public.itens_venda i
    using public.vendas v
    where i.venda_id = v.id and v.barbearia_id = v_alvo.id;

    -- 2. vendas
    delete from public.vendas where barbearia_id = v_alvo.id;

    -- 3. agendamentos — referenciam `servicos` e `barbeiros` com
    --    restrict, então saem antes dos dois.
    delete from public.agendamentos where barbearia_id = v_alvo.id;

    -- 4. o resto dos filhos diretos, agora sem ninguém apontando
    delete from public.produtos            where barbearia_id = v_alvo.id;
    delete from public.servicos            where barbearia_id = v_alvo.id;
    delete from public.barbeiros           where barbearia_id = v_alvo.id;
    delete from public.configuracao_agenda where barbearia_id = v_alvo.id;
    delete from public.folgas              where barbearia_id = v_alvo.id;

    -- 5. a conta de login. `barbearias.id` referencia `auth.users(id)`
    --    com cascade (0001), então isto leva a linha de `barbearias`
    --    junto E libera o e-mail para ser usado outra vez. Parar na
    --    tabela `barbearias` deixaria o usuário órfão no Auth com o
    --    e-mail preso para sempre — que é como as @mailinator.com
    --    sobraram.
    delete from auth.users where id = v_alvo.id;

    v_quant := v_quant + 1;
    raise notice 'BARBOS: apagada "%" (%) — dado e conta de login.',
      v_alvo.nome, v_alvo.slug;
  end loop;

  if v_quant = 0 then
    raise notice 'BARBOS: nenhuma das barbearias da lista existe. Nada a fazer.';
  else
    raise notice 'BARBOS: % barbearia(s) apagada(s).', v_quant;
  end if;
end $$;

-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   select b.id, b.nome, b.slug, u.email
--   from public.barbearias b
--   left join auth.users u on u.id = b.id
--   order by u.created_at;
--
-- As linhas têm que ter sumido, e Authentication → Users não pode
-- mais listar aqueles e-mails.
-- ------------------------------------------------------------

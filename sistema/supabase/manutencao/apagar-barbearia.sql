-- ============================================================
-- BARBOS — apagar barbearias de vez (dado + conta de login)
--
-- NÃO é migração. É operação manual, para limpar conta órfã.
-- Rodar em: Supabase → SQL Editor → New query.
--
-- ============================================================
-- POR QUE O BOTÃO DE DELETE DA TELA NUNCA VAI FUNCIONAR
-- ============================================================
--
-- Apagar a linha de `barbearias` dispara os cascatas dos filhos, e
-- três chaves estrangeiras `on delete restrict` travam no meio:
--
--   itens_venda.produto_id   -> produtos   (0007)
--   agendamentos.servico_id  -> servicos   (0003)
--   agendamentos.barbeiro_id -> barbeiros  (0015)
--
-- O painel sugere "Set an on delete behavior". NÃO FAÇA. Esses
-- `restrict` existem para que apagar um produto ou um serviço nunca
-- leve junto o histórico de quem foi atendido e do que foi vendido.
-- Trocar por cascade abriria um buraco permanente no app para
-- economizar um script que roda uma vez por ano.
--
-- A saída é apagar na ORDEM, de baixo pra cima. É o que o bloco faz.
--
-- ============================================================
-- PASSO 1 — ver TUDO que existe, com tamanho do estrago
-- ============================================================
-- Rode só este select primeiro e copie os ids que vão sair.
-- Ele mostra também as lojas desligadas, que não aparecem em lugar
-- nenhum do site.

select
  b.id,
  b.nome,
  b.slug,
  u.email,
  u.created_at::date as criada_em,
  (select count(*) from public.agendamentos a where a.barbearia_id = b.id) as agendamentos,
  (select count(*) from public.vendas       v where v.barbearia_id = b.id) as vendas,
  (select count(*) from public.produtos     p where p.barbearia_id = b.id) as produtos,
  (select count(*) from public.servicos     s where s.barbearia_id = b.id) as servicos,
  (select count(*) from public.barbeiros    q where q.barbearia_id = b.id) as barbeiros
from public.barbearias b
left join auth.users u on u.id = b.id
order by u.created_at;

-- ============================================================
-- PASSO 2 — apagar
-- ============================================================
-- Ponha os ids dentro do array, separados por vírgula. Pode ser um
-- só ou vários. Tudo num bloco: ou apaga todos, ou não apaga nenhum.

do $$
declare
  -- >>> COLE AQUI OS IDS QUE VÃO SAIR <<<
  v_ids uuid[] := array[
    '00000000-0000-0000-0000-000000000000'
    -- ,'11111111-1111-1111-1111-111111111111'
  ]::uuid[];

  -- Apelido da barbearia de trabalho. Ela NUNCA sai por este script:
  -- é onde tudo é testado (ver AGENTS.md), e recriar cardápio, equipe
  -- e estoque à mão custa uma tarde.
  v_protegida constant text := 'gabriel-teste';

  v_alvo   record;
  v_quant  int := 0;
begin
  -- Conferência antes de tocar em qualquer linha.
  if exists (
    select 1 from public.barbearias
    where id = any(v_ids) and slug = v_protegida
  ) then
    raise exception
      'BARBOS: a lista inclui a barbearia de trabalho (%). Tire o id dela e rode de novo.',
      v_protegida;
  end if;

  if not exists (select 1 from public.barbearias where id = any(v_ids)) then
    raise exception
      'BARBOS: nenhum id da lista existe em barbearias. Confira o passo 1.';
  end if;

  -- Uma volta por barbearia. Ordem de baixo pra cima: cada linha some
  -- antes de quem ela referencia, e aí os `restrict` não têm do que
  -- reclamar.
  for v_alvo in
    select b.id, b.nome, b.slug
    from public.barbearias b
    where b.id = any(v_ids)
  loop
    -- 1. itens da venda (referenciam produtos com restrict)
    delete from public.itens_venda i
    using public.vendas v
    where i.venda_id = v.id and v.barbearia_id = v_alvo.id;

    -- 2. vendas
    delete from public.vendas where barbearia_id = v_alvo.id;

    -- 3. agendamentos (referenciam servicos e barbeiros com restrict)
    delete from public.agendamentos where barbearia_id = v_alvo.id;

    -- 4. o resto dos filhos diretos
    delete from public.produtos            where barbearia_id = v_alvo.id;
    delete from public.servicos            where barbearia_id = v_alvo.id;
    delete from public.barbeiros           where barbearia_id = v_alvo.id;
    delete from public.configuracao_agenda where barbearia_id = v_alvo.id;
    delete from public.folgas              where barbearia_id = v_alvo.id;

    -- 5. a conta de login. `barbearias.id` referencia `auth.users(id)`
    --    com cascade (0001), então isto leva a barbearia junto E libera
    --    o e-mail para ser usado outra vez. Apagar só a `barbearias`
    --    deixaria o usuário órfão no Auth, com o e-mail preso para
    --    sempre — que é como as @mailinator.com sobraram.
    delete from auth.users where id = v_alvo.id;

    v_quant := v_quant + 1;
    raise notice 'BARBOS: apagada "%" (%) — dado e conta de login.',
      v_alvo.nome, v_alvo.slug;
  end loop;

  raise notice 'BARBOS: % barbearia(s) apagada(s).', v_quant;
end $$;

-- ============================================================
-- PASSO 3 — conferir
-- ============================================================
-- Rode o select do passo 1 de novo: as linhas têm que ter sumido, e
-- Authentication → Users não pode mais listar aqueles e-mails.
--
-- Se um e-mail sobrou lá, o passo 5 não rodou — o SQL Editor precisa
-- estar no papel `postgres`, que é o padrão dele.

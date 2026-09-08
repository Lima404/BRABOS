-- ============================================================
-- BARBOS — apagar o cardápio de uma barbearia
--
-- NÃO é migração. Operação manual.
-- Rodar em: Supabase → SQL Editor → New query.
--
-- ============================================================
-- O QUE VOCÊ PRECISA SABER ANTES
-- ============================================================
--
-- `agendamentos.servico_id -> servicos` é `on delete restrict`
-- (migração 0003). Isso significa: serviço que já foi agendado
-- alguma vez NÃO SAI enquanto o agendamento existir.
--
-- Então "apagar todos os serviços" é, na prática, "apagar todos os
-- serviços E toda a agenda". Não tem meio-termo para os serviços que
-- têm histórico — o `restrict` está ali exatamente para impedir que
-- apagar um item de cardápio evapore o registro de quem foi atendido.
--
-- O QUE **NÃO** SOME junto:
--   - as vendas da loja e os itens delas. `vendas.agendamento_id` é
--     `on delete set null` (0009), então a venda sobrevive e só perde
--     o vínculo com o atendimento. O dinheiro entrou; apagar receita
--     porque o agendamento saiu seria mentir sobre o caixa.
--   - produtos, estoque, equipe, folgas e configuração da agenda.
--
-- Se o que você quer é só TIRAR DA TELA sem perder o histórico, o
-- caminho é outro e está no PASSO 3 lá embaixo: `ativo = false`.
-- ============================================================

-- ============================================================
-- PASSO 1 — ver o que cada serviço carrega
-- ============================================================
-- Rode só isto primeiro. A coluna `agendamentos` diz quantos registros
-- somem junto com aquele serviço.

select
  s.id,
  s.nome,
  s.preco_centavos,
  s.ativo,
  (select count(*) from public.agendamentos a where a.servico_id = s.id) as agendamentos
from public.servicos s
where s.barbearia_id = '40850c4c-a604-4243-a6d4-ee00f2214a60'  -- gabriel-teste
order by s.ordem, s.nome;

-- ============================================================
-- PASSO 2 — apagar cardápio + agenda
-- ============================================================
-- Tudo num bloco: ou vai inteiro, ou não vai nada.

do $$
declare
  -- >>> A BARBEARIA <<<
  v_id uuid := '40850c4c-a604-4243-a6d4-ee00f2214a60';  -- gabriel-teste

  v_nome       text;
  v_agend      int;
  v_serv       int;
  v_desligadas int;
begin
  select nome into v_nome from public.barbearias where id = v_id;

  if v_nome is null then
    raise exception 'BARBOS: não existe barbearia com id %.', v_id;
  end if;

  -- Quantas vendas vão perder o vínculo — a venda continua, e é bom
  -- saber o tamanho disso antes de olhar o dashboard e estranhar.
  select count(*) into v_desligadas
  from public.vendas v
  join public.agendamentos a on a.id = v.agendamento_id
  where a.barbearia_id = v_id;

  -- 1. a agenda. É ela que segura os serviços pelo `restrict`.
  delete from public.agendamentos where barbearia_id = v_id;
  get diagnostics v_agend = row_count;

  -- 2. o cardápio, agora sem ninguém apontando
  delete from public.servicos where barbearia_id = v_id;
  get diagnostics v_serv = row_count;

  raise notice 'BARBOS: "%" — % agendamento(s) e % serviço(s) apagados.',
    v_nome, v_agend, v_serv;
  raise notice 'BARBOS: % venda(s) continuam no caixa, agora sem vínculo com atendimento.',
    v_desligadas;
end $$;

-- ============================================================
-- PASSO 3 — a alternativa que NÃO perde histórico
-- ============================================================
-- Se a ideia era só limpar a tela, não rode o passo 2: desative.
-- Serviço desativado some da legenda, do filtro e do formulário de
-- agendamento, mas o passado continua de pé e o dashboard continua
-- somando certo. É o caminho que o próprio app usa no botão
-- "Desativar serviço".
--
--   update public.servicos
--   set ativo = false
--   where barbearia_id = '40850c4c-a604-4243-a6d4-ee00f2214a60';
--
-- O índice único de nome é parcial (`where ativo`), então dá pra
-- cadastrar "Cabelo" de novo com outro preço sem conflito.

-- ============================================================
-- PASSO 4 — conferir
-- ============================================================
-- Rode o select do passo 1 de novo: não pode voltar nenhuma linha.
-- Na tela, a agenda abre vazia e a legenda vira o convite
-- "Cadastrar serviço" — o mesmo estado de uma barbearia recém-criada
-- desde a migração 0021.

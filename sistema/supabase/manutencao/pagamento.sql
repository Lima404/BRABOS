-- ============================================================
-- BARBOS — pagamento: o que se faz na mão (depois da 0041)
--
-- Rodar em: Supabase → SQL Editor. Uma linha de cada vez, trocando o que
-- está entre aspas. Nenhuma destas funções é chamável pela API: só daqui.
-- ============================================================


-- ---------- Liberar uma barbearia que já tem conta ----------
-- Pelo e-mail do login. Vale até alguém bloquear (pedido "manual").
select public.liberar_barbearia('email@dabarbearia.com', 'pagou por fora em 10/11');


-- ---------- Bloquear ----------
-- Desfaz a liberação manual. Se ela também pagou pelo Asaas, continua
-- liberada pelo pagamento, e a resposta diz isso.
select public.bloquear_barbearia('email@dabarbearia.com');


-- ---------- Convites: quem pagou por fora e ainda não tem conta ----------
-- Um link de cadastro por barbearia. Quem se cadastra por ele já nasce
-- liberado. Cada link vale para UMA conta.
select link from public.gerar_convites(27, 'barbearias fechadas em novembro');


-- ---------- Quem está liberado, e por quê ----------
select b.slug, b.pagamento_ativo, p.plano, p.situacao, p.acesso_ate, p.observacao
from public.barbearias b
left join lateral (
  select * from public.pedidos
  where barbearia_id = b.id
  order by (situacao = 'pago') desc, coalesce(pago_em, criado_em) desc
  limit 1
) p on true
order by b.pagamento_ativo, b.slug;


-- ---------- Os últimos avisos do Asaas ----------
select recebido_em, evento, carga->'payment'->>'id' as cobranca, carga->'checkout'->>'id' as checkout
from public.eventos_asaas
order by recebido_em desc
limit 20;


-- ============================================================
-- O SEGREDO DO WEBHOOK — uma vez, no dia da instalação
--
-- O mesmo valor vai em três lugares, e os três têm que bater:
--   1. aqui, na tabela `segredos`;
--   2. na Vercel (projeto do sistema), variável ASAAS_WEBHOOK_TOKEN;
--   3. no Asaas, como token de autenticação do webhook.
-- Nunca commitar o valor. Trocar = repetir os três.
-- ============================================================
insert into public.segredos (nome, valor)
values ('asaas_webhook', 'COLE-AQUI-O-SEGREDO')
on conflict (nome) do update set valor = excluded.valor;

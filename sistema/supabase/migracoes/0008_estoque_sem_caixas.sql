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

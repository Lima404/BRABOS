-- ============================================================
-- BARBOS — migração 0025: desfazer o catálogo de nomes (0024)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0024. Pode rodar mais de uma vez.
--
-- A 0024 já tinha sido aplicada, então apagar o arquivo dela não
-- desfaria nada — quem desfaz é isto aqui.
--
-- Volta ao estado anterior: `servicos.nome` e `produtos.nome`
-- voltam a ser texto comum, cada barbearia com o seu, sem catálogo
-- compartilhado e sem grafia imposta por quem cadastrou primeiro.
--
-- NADA DE DADO SE PERDE. A 0024 mantinha `nome` preenchido o tempo
-- todo (era espelho), então derrubar `nome_id` e os catálogos não
-- tira nome de serviço nem de produto de ninguém. O único efeito
-- visível é que a grafia canonizada por ela continua gravada — se
-- algum nome ficou em caixa alta por causa disso, é só reeditar.
--
-- A 0024 fica na pasta de propósito: ela foi aplicada no banco, e
-- apagar o arquivo esconderia isso de quem replicar as migrações.
-- ============================================================

-- 1. Os gatilhos primeiro. Enquanto eles existirem, qualquer
--    insert/update em servicos ou produtos tenta escrever numa
--    coluna e num catálogo que estão prestes a sumir.
drop trigger if exists resolver_nome_servico on public.servicos;
drop trigger if exists resolver_nome_produto on public.produtos;

drop function if exists public.resolver_nome_do_servico();
drop function if exists public.resolver_nome_do_produto();

-- 2. Os índices que dependiam de nome_id.
drop index if exists public.servicos_nome_id_ativo_unico;
drop index if exists public.produtos_nome_id_tipo_unico;

-- 3. As colunas de ligação. Saem antes dos catálogos porque a chave
--    estrangeira aponta pra lá.
alter table public.servicos drop column if exists nome_id;
alter table public.produtos drop column if exists nome_id;

-- 4. Os catálogos e os gatilhos deles.
drop trigger if exists chave_do_nome_servico on public.nomes_de_servico;
drop trigger if exists chave_do_nome_produto on public.nomes_de_produto;

drop table if exists public.nomes_de_servico;
drop table if exists public.nomes_de_produto;

drop function if exists public.preencher_chave_do_nome();

-- 5. As funções achar-ou-criar.
drop function if exists public.nome_de_servico_id(text);
drop function if exists public.nome_de_produto_id(text);

-- 6. `normalizar_nome` fica.
--    É uma função pura de texto, não pertence ao catálogo, e serve
--    pra qualquer comparação de nome que apareça depois. Derrubar
--    não devolve nada em troca.

-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   select column_name from information_schema.columns
--   where table_schema = 'public'
--     and table_name in ('servicos','produtos')
--     and column_name = 'nome_id';       -- tem que vir vazio
--
--   select to_regclass('public.nomes_de_servico');  -- tem que ser null
--
--   select nome from public.servicos order by nome; -- nomes intactos
-- ------------------------------------------------------------

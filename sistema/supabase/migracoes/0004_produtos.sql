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

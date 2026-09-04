-- ============================================================
-- BARBOS — migração 0007: vendas da loja (mercearia)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0004 e 0005. Pode rodar mais de uma vez sem quebrar.
--
-- O cliente do QR code não tem sessão. Ele NÃO escreve em `produtos` nem
-- em `vendas` direto — só chama a função `confirmar_compra_loja`, que:
--   1. resolve a barbearia pelo slug
--   2. confere se o produto é mercearia e está à venda
--   3. grava a venda com preço congelado
--   4. baixa o estoque (unidades)
-- ============================================================

do $$
begin
  create type public.status_venda as enum ('confirmada', 'cancelada');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.vendas (
  id              uuid primary key default gen_random_uuid(),

  barbearia_id    uuid not null
                    references public.barbearias(id) on delete cascade,

  -- Total em centavos no momento da compra.
  total_centavos  integer not null check (total_centavos >= 0),

  status          public.status_venda not null default 'confirmada',

  criado_em       timestamptz not null default now()
);

comment on table public.vendas is
  'Compra feita na loja pública (QR). Cliente anônimo; barbearia vem do slug.';

create index if not exists vendas_barbearia_criado_idx
  on public.vendas (barbearia_id, criado_em desc);

alter table public.vendas enable row level security;

drop policy if exists "vendas da propria barbearia" on public.vendas;
create policy "vendas da propria barbearia" on public.vendas
  for select
  using (barbearia_id = auth.uid());

-- A dona lê. Insert/update públicos só pela RPC abaixo.

create table if not exists public.itens_venda (
  id              uuid primary key default gen_random_uuid(),

  venda_id        uuid not null
                    references public.vendas(id) on delete cascade,

  produto_id      uuid not null
                    references public.produtos(id) on delete restrict,

  -- Snapshot: reajuste de preço depois não reescreve o que o cliente pagou.
  nome            text not null,
  preco_centavos  integer not null check (preco_centavos >= 0),
  quantidade      integer not null check (quantidade > 0)
);

comment on table public.itens_venda is
  'Itens de uma venda. Nome e preço congelados no momento da compra.';

create index if not exists itens_venda_venda_idx
  on public.itens_venda (venda_id);

create index if not exists itens_venda_produto_idx
  on public.itens_venda (produto_id);

alter table public.itens_venda enable row level security;

drop policy if exists "itens de venda da propria barbearia" on public.itens_venda;
create policy "itens de venda da propria barbearia" on public.itens_venda
  for select
  using (
    exists (
      select 1 from public.vendas v
      where v.id = itens_venda.venda_id
        and v.barbearia_id = auth.uid()
    )
  );

-- ============================================================
-- RPC pública: confirmar compra
--
-- security definer: roda com privilégio do dono da função, atravessa o RLS
-- de produtos/vendas. Por isso a validação é rígida (slug + mercearia +
-- estoque). Grant EXECUTE a anon — sem abrir as tabelas.
-- ============================================================

create or replace function public.confirmar_compra_loja(
  p_slug text,
  p_produto_id uuid,
  p_quantidade integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_produto record;
  v_venda_id uuid;
  v_total integer;
begin
  if p_quantidade is null or p_quantidade < 1 or p_quantidade > 99 then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
  end if;

  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta loja não está disponível.');
  end if;

  -- Trava a linha do produto pra duas compras simultâneas não venderem o
  -- mesmo estoque.
  select
    p.id,
    p.nome,
    p.preco_centavos,
    p.unidades,
    p.tipo,
    p.barbearia_id
  into v_produto
  from public.produtos p
  where p.id = p_produto_id
    and p.barbearia_id = v_loja_id
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado nesta loja.');
  end if;

  if v_produto.tipo not in ('mercearia', 'salao') then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.preco_centavos <= 0 then
    return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
  end if;

  if v_produto.unidades < p_quantidade then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Não tem essa quantidade disponível. Escolha menos ou pergunte no balcão.'
    );
  end if;

  v_total := v_produto.preco_centavos * p_quantidade;

  insert into public.vendas (barbearia_id, total_centavos, status)
  values (v_loja_id, v_total, 'confirmada')
  returning id into v_venda_id;

  insert into public.itens_venda (
    venda_id, produto_id, nome, preco_centavos, quantidade
  ) values (
    v_venda_id,
    v_produto.id,
    v_produto.nome,
    v_produto.preco_centavos,
    p_quantidade
  );

  update public.produtos
  set unidades = unidades - p_quantidade
  where id = v_produto.id;

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'nome', v_produto.nome,
    'quantidade', p_quantidade
  );
end $$;

comment on function public.confirmar_compra_loja is
  'Compra anônima na loja. Mercearia ou salão com preço > 0; baixa unidades.';

revoke all on function public.confirmar_compra_loja(text, uuid, integer) from public;
grant execute on function public.confirmar_compra_loja(text, uuid, integer)
  to anon, authenticated;

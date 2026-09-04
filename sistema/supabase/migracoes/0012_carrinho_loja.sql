-- ============================================================
-- BARBOS — migração 0012: carrinho na loja (vários itens, uma venda)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0007 e 0009. Pode rodar mais de uma vez sem quebrar.
--
-- O cliente do QR monta um pedido com vários produtos e confirma uma
-- vez. Uma venda, vários `itens_venda`, estoque baixado na mesma
-- transação. A RPC de um item (`confirmar_compra_loja`) continua.
-- ============================================================

create or replace function public.confirmar_carrinho_loja(
  p_slug text,
  p_itens jsonb,
  p_agendamento_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_agendamento_id uuid := null;
  v_venda_id uuid;
  v_total integer := 0;
  v_qtd_unidades integer := 0;
  v_qtd_linhas integer := 0;
  v_produto record;
  r record;
begin
  if p_itens is null or jsonb_typeof(p_itens) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Escolha pelo menos um produto.');
  end if;

  if jsonb_array_length(p_itens) < 1 or jsonb_array_length(p_itens) > 40 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha entre 1 e 40 produtos no pedido.');
  end if;

  -- Formato: cada elemento precisa de produto_id (uuid) e quantidade (1–99).
  if exists (
    select 1
    from jsonb_array_elements(p_itens) elem
    where (elem->>'produto_id') is null
       or (elem->>'quantidade') is null
       or (elem->>'quantidade') !~ '^[0-9]+$'
       or (elem->>'quantidade')::integer < 1
       or (elem->>'quantidade')::integer > 99
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
  end if;

  begin
    perform (elem->>'produto_id')::uuid
    from jsonb_array_elements(p_itens) elem;
  exception
    when others then
      return jsonb_build_object('ok', false, 'erro', 'Produto inválido no pedido.');
  end;

  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Esta loja não está disponível.');
  end if;

  if p_agendamento_id is not null then
    select a.id into v_agendamento_id
    from public.agendamentos a
    where a.id = p_agendamento_id
      and a.barbearia_id = v_loja_id
      and a.estado not in ('cancelado', 'faltou');

    if v_agendamento_id is null then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse agendamento não é mais válido. Escolha de novo ou marque como avulsa.'
      );
    end if;
  end if;

  -- Agrupa o mesmo produto e trava em ordem de id (evita deadlock).
  for r in
    select
      (elem->>'produto_id')::uuid as produto_id,
      sum((elem->>'quantidade')::integer)::integer as quantidade
    from jsonb_array_elements(p_itens) elem
    group by 1
    order by 1
  loop
    if r.quantidade > 99 then
      return jsonb_build_object('ok', false, 'erro', 'Informe uma quantidade entre 1 e 99.');
    end if;

    select
      p.id,
      p.nome,
      p.preco_centavos,
      p.unidades,
      p.tipo
    into v_produto
    from public.produtos p
    where p.id = r.produto_id
      and p.barbearia_id = v_loja_id
    for update;

    if not found then
      return jsonb_build_object('ok', false, 'erro', 'Produto não encontrado nesta loja.');
    end if;

    if v_produto.tipo not in ('mercearia', 'salao') or v_produto.preco_centavos <= 0 then
      return jsonb_build_object('ok', false, 'erro', 'Esse produto não está à venda na loja.');
    end if;

    if v_produto.unidades < r.quantidade then
      return jsonb_build_object(
        'ok', false,
        'erro', format(
          'Não tem quantidade suficiente de %s. Escolha menos ou pergunte no balcão.',
          v_produto.nome
        )
      );
    end if;

    v_total := v_total + (v_produto.preco_centavos * r.quantidade);
    v_qtd_unidades := v_qtd_unidades + r.quantidade;
    v_qtd_linhas := v_qtd_linhas + 1;
  end loop;

  if v_qtd_linhas = 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha pelo menos um produto.');
  end if;

  insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
  values (v_loja_id, v_total, 'confirmada', v_agendamento_id)
  returning id into v_venda_id;

  for r in
    select
      (elem->>'produto_id')::uuid as produto_id,
      sum((elem->>'quantidade')::integer)::integer as quantidade
    from jsonb_array_elements(p_itens) elem
    group by 1
    order by 1
  loop
    select p.id, p.nome, p.preco_centavos
    into v_produto
    from public.produtos p
    where p.id = r.produto_id
      and p.barbearia_id = v_loja_id;

    insert into public.itens_venda (
      venda_id, produto_id, nome, preco_centavos, quantidade
    ) values (
      v_venda_id,
      v_produto.id,
      v_produto.nome,
      v_produto.preco_centavos,
      r.quantidade
    );

    update public.produtos
    set unidades = unidades - r.quantidade
    where id = v_produto.id;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'venda_id', v_venda_id,
    'total_centavos', v_total,
    'quantidade', v_qtd_unidades,
    'itens', v_qtd_linhas,
    'agendamento_id', v_agendamento_id
  );
end $$;

comment on function public.confirmar_carrinho_loja is
  'Pedido anônimo na loja com vários itens. Uma venda; baixa estoque de todos.';

revoke all on function public.confirmar_carrinho_loja(text, jsonb, uuid) from public;
grant execute on function public.confirmar_carrinho_loja(text, jsonb, uuid)
  to anon, authenticated;

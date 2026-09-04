-- ============================================================
-- BARBOS — migração 0009: venda ligada ao agendamento do dia
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0004, 0005 e 0007. Pode rodar mais de uma vez.
--
-- O que muda:
--   1. `vendas` ganha `agendamento_id` (nulo = compra avulsa)
--   2. RPC pública `clientes_do_dia_loja` — a lista do seletor
--   3. `confirmar_compra_loja` passa a aceitar o agendamento escolhido
--
-- PRIVACIDADE — leia antes de mexer:
-- a loja abre SEM sessão (é o destino do QR code). Devolver a lista de
-- clientes do dia para qualquer visitante publicaria nome e horário de todo
-- mundo que passou na barbearia, num endereço que qualquer um abre e que o
-- Google indexa. Por isso `clientes_do_dia_loja` só devolve `cliente_nome`
-- quando quem pergunta é a própria dona (auth.uid() = barbearia). Para o
-- visitante anônimo vai só horário e serviço — o bastante para ele dizer
-- "o meu é o das 10:30" sem entregar a agenda alheia.
-- ============================================================

-- ------------------------------------------------------------
-- 1. A coluna
-- ------------------------------------------------------------

alter table public.vendas
  add column if not exists agendamento_id uuid
    references public.agendamentos(id) on delete set null;

comment on column public.vendas.agendamento_id is
  'Agendamento a que a compra foi lançada. Nulo = compra avulsa (balcão).';

-- `set null` e não `cascade`: apagar um agendamento não pode apagar a venda
-- junto — o dinheiro entrou de qualquer jeito, e sumir com ele faria o
-- faturamento do dia mudar sozinho.

create index if not exists vendas_agendamento_idx
  on public.vendas (agendamento_id)
  where agendamento_id is not null;

-- ------------------------------------------------------------
-- 2. A lista do seletor
-- ------------------------------------------------------------

create or replace function public.clientes_do_dia_loja(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_eh_dona boolean;
begin
  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return '[]'::jsonb;
  end if;

  v_eh_dona := auth.uid() is not null and auth.uid() = v_loja_id;

  return coalesce(
    (
      select jsonb_agg(linha order by linha->>'horario')
      from (
        select jsonb_build_object(
                 'id', a.id,
                 'horario', to_char(a.horario, 'HH24:MI'),
                 'servico', s.nome,
                 -- Nome só para a dona. Ver o bloco PRIVACIDADE no topo.
                 'clienteNome',
                 case when v_eh_dona then a.cliente_nome else null end
               ) as linha
        from public.agendamentos a
        join public.servicos s on s.id = a.servico_id
        where a.barbearia_id = v_loja_id
          and a.data = p_data
          -- Cancelado e falta não compram nada: quem não veio não leva.
          and a.estado not in ('cancelado', 'faltou')
      ) as linhas
    ),
    '[]'::jsonb
  );
end $$;

comment on function public.clientes_do_dia_loja is
  'Agendamentos do dia para o seletor da loja. Nome do cliente só para a dona.';

revoke all on function public.clientes_do_dia_loja(text, date) from public;
grant execute on function public.clientes_do_dia_loja(text, date)
  to anon, authenticated;

-- ------------------------------------------------------------
-- 3. A compra passa a saber de quem é
-- ------------------------------------------------------------

-- Some com a assinatura de 3 argumentos para não ficarem duas funções com o
-- mesmo nome: o PostgREST escolhe a sobrecarga pelos nomes dos argumentos
-- recebidos, e duas candidatas viram erro de ambiguidade em runtime.
drop function if exists public.confirmar_compra_loja(text, uuid, integer);

create or replace function public.confirmar_compra_loja(
  p_slug text,
  p_produto_id uuid,
  p_quantidade integer,
  p_agendamento_id uuid default null
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
  v_agendamento_id uuid := null;
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

  -- O agendamento tem que ser DESTA barbearia. Sem essa checagem, um id de
  -- outra loja penduraria a compra na conta de um estranho.
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

  insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
  values (v_loja_id, v_total, 'confirmada', v_agendamento_id)
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
    'quantidade', p_quantidade,
    'agendamento_id', v_agendamento_id
  );
end $$;

comment on function public.confirmar_compra_loja is
  'Compra anônima na loja. Mercearia ou salão com preço > 0; baixa unidades. Pode ser lançada num agendamento do dia.';

revoke all on function public.confirmar_compra_loja(text, uuid, integer, uuid) from public;
grant execute on function public.confirmar_compra_loja(text, uuid, integer, uuid)
  to anon, authenticated;

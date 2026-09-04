-- ============================================================
-- BARBOS — migração 0011: editar o consumo de um atendimento
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0004, 0007 e 0009. Pode rodar mais de uma vez.
--
-- Uma função só, `ajustar_comanda`, que recebe a lista inteira de mudanças e
-- aplica TUDO ou NADA. Por que não três funções (alterar, remover,
-- acrescentar) chamadas em sequência pela tela: cada linha da comanda mexe no
-- estoque, e uma sequência que falha no meio deixa o estoque contando
-- unidades que ninguém tirou da prateleira. Erro aqui é `raise`, não
-- `return` — a exceção desfaz o bloco inteiro; um `return` no meio do laço
-- teria gravado o que já passou.
--
-- É operação da DONA, não do cliente do QR: exige sessão e confere que o
-- agendamento é da barbearia logada. Só `authenticated` recebe o grant.
-- ============================================================

create or replace function public.ajustar_comanda(
  p_agendamento_id uuid,
  p_mudancas jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid;
  v_mudanca   jsonb;
  v_item      record;
  v_produto   record;
  v_delta     integer;
  v_qtd       integer;
  v_venda_id  uuid;
  v_mexeu     integer := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sua sessão expirou. Entre de novo.');
  end if;

  select a.barbearia_id into v_barbearia
  from public.agendamentos a
  where a.id = p_agendamento_id;

  if v_barbearia is null or v_barbearia <> auth.uid() then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento não é desta barbearia.');
  end if;

  if p_mudancas is null or jsonb_typeof(p_mudancas) <> 'array' then
    return jsonb_build_object('ok', false, 'erro', 'Nada para alterar.');
  end if;

  -- Bloco com tratamento = subtransação: o `raise` lá dentro desfaz todas as
  -- linhas já mexidas neste laço, inclusive as baixas de estoque.
  begin
    for v_mudanca in select * from jsonb_array_elements(p_mudancas)
    loop
      v_qtd := coalesce((v_mudanca->>'quantidade')::integer, -1);

      if v_qtd < 0 or v_qtd > 99 then
        raise exception using errcode = 'BR001',
          message = 'Quantidade tem que ser de 0 a 99.';
      end if;

      -- ---------- linha que já existe: alterar ou remover ----------
      if (v_mudanca->>'item_id') is not null then

        select
          i.id,
          i.quantidade,
          i.produto_id,
          i.nome,
          v.id as venda_id
        into v_item
        from public.itens_venda i
        join public.vendas v on v.id = i.venda_id
        where i.id = (v_mudanca->>'item_id')::uuid
          and v.agendamento_id = p_agendamento_id
          and v.barbearia_id = v_barbearia
        for update of i, v;

        if not found then
          raise exception using errcode = 'BR001',
            message = 'Um dos itens já não está neste atendimento. Recarregue a página.';
        end if;

        -- Positivo = vai sair mais do estoque; negativo = volta pra prateleira.
        v_delta := v_qtd - v_item.quantidade;

        if v_delta <> 0 then
          update public.produtos
          set unidades = unidades - v_delta
          where id = v_item.produto_id
            and barbearia_id = v_barbearia
            and unidades - v_delta >= 0;

          if not found then
            raise exception using errcode = 'BR001',
              message = 'Não tem estoque suficiente de ' || v_item.nome || '.';
          end if;
        end if;

        if v_qtd = 0 then
          delete from public.itens_venda where id = v_item.id;
        else
          update public.itens_venda set quantidade = v_qtd where id = v_item.id;
        end if;

        v_mexeu := v_mexeu + 1;

      -- ---------- linha nova: acrescentar ----------
      elsif (v_mudanca->>'produto_id') is not null then

        if v_qtd < 1 then
          continue;
        end if;

        select p.id, p.nome, p.preco_centavos, p.unidades
        into v_produto
        from public.produtos p
        where p.id = (v_mudanca->>'produto_id')::uuid
          and p.barbearia_id = v_barbearia
        for update;

        if not found then
          raise exception using errcode = 'BR001',
            message = 'Produto não encontrado nesta barbearia.';
        end if;

        if v_produto.preco_centavos <= 0 then
          raise exception using errcode = 'BR001',
            message = v_produto.nome || ' está sem preço. Defina no estoque antes de lançar.';
        end if;

        if v_produto.unidades < v_qtd then
          raise exception using errcode = 'BR001',
            message = 'Só tem ' || v_produto.unidades || ' un. de ' || v_produto.nome || '.';
        end if;

        -- Uma venda por lançamento, igual à loja: assim o histórico continua
        -- sendo "o que foi comprado numa hora", e não um saco que cresce.
        insert into public.vendas (barbearia_id, total_centavos, status, agendamento_id)
        values (
          v_barbearia,
          v_produto.preco_centavos * v_qtd,
          'confirmada',
          p_agendamento_id
        )
        returning id into v_venda_id;

        -- Nome e preço congelados aqui, como na compra pela loja.
        insert into public.itens_venda (
          venda_id, produto_id, nome, preco_centavos, quantidade
        ) values (
          v_venda_id,
          v_produto.id,
          v_produto.nome,
          v_produto.preco_centavos,
          v_qtd
        );

        update public.produtos
        set unidades = unidades - v_qtd
        where id = v_produto.id;

        v_mexeu := v_mexeu + 1;

      else
        raise exception using errcode = 'BR001',
          message = 'Mudança sem item_id nem produto_id.';
      end if;
    end loop;

    -- O total da venda é derivado dos itens: recalcular é mais barato que
    -- manter somado à mão em três lugares e descobrir a diferença no caixa.
    update public.vendas v
    set total_centavos = coalesce(
      (select sum(i.preco_centavos * i.quantidade)
         from public.itens_venda i
        where i.venda_id = v.id),
      0
    )
    where v.agendamento_id = p_agendamento_id
      and v.barbearia_id = v_barbearia;

    -- Venda que ficou sem item nenhum sai: R$ 0,00 pendurado no atendimento
    -- vira linha fantasma no relatório.
    delete from public.vendas v
    where v.agendamento_id = p_agendamento_id
      and v.barbearia_id = v_barbearia
      and not exists (
        select 1 from public.itens_venda i where i.venda_id = v.id
      );

  exception
    when sqlstate 'BR001' then
      -- Só o erro de regra vira resposta. Falha de verdade (constraint,
      -- deadlock) sobe e aborta tudo, que é o que deve acontecer.
      return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'mudancas', v_mexeu);
end $$;

comment on function public.ajustar_comanda is
  'Altera, remove e acrescenta itens do consumo de um atendimento, ajustando o estoque. Tudo ou nada.';

revoke all on function public.ajustar_comanda(uuid, jsonb) from public;
grant execute on function public.ajustar_comanda(uuid, jsonb) to authenticated;

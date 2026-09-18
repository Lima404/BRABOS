-- ============================================================
-- BARBOS — migração 0029: marcar produto é pedir a prateleira
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0028. Pode rodar mais de uma vez.
--
-- ============================================================
-- A REGRA, AGORA DITA DE UMA VEZ SÓ
-- ============================================================
--
-- **O que está marcado manda. O que está limpo traz tudo.**
--
-- Marcar ENERGETICO é perguntar quanto o energético rendeu — não é
-- perguntar isso E, de brinde, quanto renderam os cortes. Até aqui o
-- filtro de produto recortava a loja e deixava o cartão SERVIÇOS
-- inteiro ao lado, e o TOTAL somava os dois.
--
-- Esta migração fecha o conjunto. As três migrações juntas:
--
--   0027  o filtro de serviço passou a alcançar a loja
--   0028  …e virou "só a cadeira": serviço marcado zera a loja
--   0029  produto marcado zera os serviços
--
-- O quadro final:
--
--   marcou serviço   →  serviços filtrados,  loja = 0
--   marcou produto   →  loja filtrada,       serviços = 0
--   marcou "só loja" →  loja inteira,        serviços = 0
--   marcou barbeiro  →  os dois lados, filtrados por ele
--   não marcou nada  →  tudo
--
-- ============================================================
-- POR QUE O BARBEIRO É A EXCEÇÃO
-- ============================================================
--
-- Serviço e produto são DE ONDE O DINHEIRO VEM: a cadeira ou a
-- prateleira. São lados opostos do mesmo total, e escolher um é
-- dispensar o outro.
--
-- Barbeiro não é origem de dinheiro, é PESSOA. O corte e o
-- refrigerante passam os dois pela mão dela, e recortar por barbeiro é
-- perguntar "quanto o Bruno movimentou" — as duas metades, filtradas.
-- Por isso ele é o único filtro que não zera nada.
--
-- ============================================================
-- COMBINAÇÕES QUE SE ANULAM
-- ============================================================
--
-- serviço + produto, e serviço + "só loja": um lado esconde o outro e
-- o recorte volta zerado. O banco devolve zero nos dois cartões, que é
-- a resposta honesta — ele não adivinha qual dos dois a pessoa quis.
-- Quem avisa antes é o rodapé do diálogo de filtros.
-- ============================================================


-- ------------------------------------------------------------
-- Uma variável, quatro lugares
-- ------------------------------------------------------------
-- O lado dos SERVIÇOS já saía do recorte por um caminho ("só loja") e
-- agora sai por dois. Os quatro lugares que precisam concordar (receita
-- de serviço, rosca de serviços, e os dois campos da série de meses)
-- passam a ler `v_sem_servicos` em vez de repetir a condição — é o
-- mesmo remédio da 0027, pelo mesmo motivo.
--
-- Mesma assinatura e mesmo corpo da 0028; nada no lado da LOJA mudou.

create or replace function public.resumo_dashboard(
  p_inicio date,
  p_fim date,
  p_servico_ids uuid[] default null,
  p_barbeiro_ids uuid[] default null,
  p_produto_ids uuid[] default null,
  p_so_loja boolean default false
)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint := 0;
  v_atendimentos     bigint := 0;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb := '[]'::jsonb;
  v_produtos jsonb;
  v_meses    jsonb;

  v_filtra_servico  boolean;
  v_filtra_barbeiro boolean;
  v_filtra_produto  boolean;
  -- O lado dos SERVICOS sai do recorte por dois caminhos: a caixa
  -- "so loja" e a escolha de produtos. Uma variavel so para os dois,
  -- porque sao quatro lugares que precisam concordar.
  v_sem_servicos    boolean;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;
  v_filtra_produto := p_produto_ids is not null and cardinality(p_produto_ids) > 0;

  -- Marcar produto e pedir a PRATELEIRA: quem quer saber quanto o
  -- energetico rendeu nao esta perguntando quanto renderam os cortes.
  v_sem_servicos := coalesce(p_so_loja, false) or v_filtra_produto;

  if not v_sem_servicos then
    select coalesce(sum(a.preco_centavos), 0), count(*)
    into v_servico_centavos, v_atendimentos
    from public.agendamentos a
    where a.estado = 'concluido'
      and a.data >= p_inicio
      and a.data < p_fim
      and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
      and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids));
  end if;

  -- Escolher serviço é escolher a CADEIRA: a loja sai inteira do recorte.
  -- Primeiro ramo de propósito — nem chega a consultar vendas.
  if v_filtra_servico then
    v_loja_centavos := 0;
    v_vendas := 0;

  -- Com filtro de produto: soma as LINHAS, não o total da venda inteira.
  elsif v_filtra_produto then
    select coalesce(sum(i.preco_centavos * i.quantidade), 0),
           count(distinct v.id)
    into v_loja_centavos, v_vendas
    from public.itens_venda i
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and i.produto_id = any (p_produto_ids)
      and public.venda_no_recorte(v.agendamento_id, p_barbeiro_ids);
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas_no_caixa v
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and public.venda_no_recorte(v.agendamento_id, p_barbeiro_ids);
  end if;

  if not v_sem_servicos then
    select coalesce(jsonb_agg(linha order by (linha->>'totalCentavos')::bigint desc), '[]'::jsonb)
    into v_servicos
    from (
      select jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'quantidade', count(*),
               'totalCentavos', coalesce(sum(a.preco_centavos), 0)
             ) as linha
      from public.agendamentos a
      join public.servicos s on s.id = a.servico_id
      where a.estado = 'concluido'
        and a.data >= p_inicio
        and a.data < p_fim
        and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
        and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
      group by s.id, s.nome, s.cor
    ) t;
  end if;

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and not v_filtra_servico
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and public.venda_no_recorte(v.agendamento_id, p_barbeiro_ids)
    group by i.nome
  ) t;

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas_no_caixa v)
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      date_trunc('month', p_inicio)::date
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', case
                 when v_sem_servicos then 0
                 else (
                   select coalesce(sum(a.preco_centavos), 0)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end,
               'lojaCentavos', case
                 when v_filtra_servico then 0
                 when v_filtra_produto then (
                   select coalesce(sum(i.preco_centavos * i.quantidade), 0)
                   from public.itens_venda i
                   join public.vendas_no_caixa v on v.id = i.venda_id
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and public.venda_no_recorte(v.agendamento_id, p_barbeiro_ids)
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas_no_caixa v
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and public.venda_no_recorte(v.agendamento_id, p_barbeiro_ids)
                 )
               end,
               'atendimentos', case
                 when v_sem_servicos then 0
                 else (
                   select count(*)
                   from public.agendamentos a
                   where a.estado = 'concluido'
                     and a.data >= m.mes
                     and a.data < (m.mes + interval '1 month')::date
                     and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
                     and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids))
                 )
               end
             ) as linha
      from (
        select generate_series(
                 date_trunc('month', v_primeiro)::date,
                 v_ultimo,
                 interval '1 month'
               )::date as mes
      ) m
    ) t;
  end if;

  return jsonb_build_object(
    'mes', to_char(p_inicio, 'YYYY-MM'),
    'inicio', p_inicio,
    'fim', p_fim,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', coalesce(v_produtos, '[]'::jsonb),
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Numeros do dashboard no intervalo [inicio, fim). O que esta marcado manda: servico zera a loja, produto e "so loja" zeram os servicos, barbeiro filtra os dois lados.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;

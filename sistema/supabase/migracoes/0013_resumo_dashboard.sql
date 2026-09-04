-- ============================================================
-- BARBOS — migração 0013: os números do dashboard
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0003, 0007 e 0009. Pode rodar mais de uma vez.
--
-- Uma função só, `resumo_dashboard`, que devolve o mês pedido e a série de
-- TODOS os meses numa ida só. Somar isso no navegador exigiria baixar o
-- histórico inteiro a cada abertura da tela — e ainda erraria o mês das
-- vendas, porque `criado_em` é timestamptz e o corte de mês é o do relógio
-- da barbearia, não o de Greenwich.
--
-- `security invoker`: o RLS de agendamentos, vendas e itens_venda já limita
-- tudo à barbearia logada. Definer aqui só ampliaria o alcance sem precisão.
--
-- O QUE ENTRA NA CONTA — a regra vive aqui, e é a única cópia dela:
--   serviço = agendamento com estado 'concluido' (foi atendido e pago)
--   loja    = venda com status 'confirmada'
--
-- Repare que a venda NÃO exige agendamento concluído. Ela é o próprio
-- pagamento: quem leu o QR e levou o refrigerante pagou no balcão, sem passar
-- pela cadeira. Amarrar a receita da loja ao estado do agendamento apagaria
-- toda a venda avulsa — que é justamente para quem a loja foi feita.
-- ============================================================

create or replace function public.resumo_dashboard(p_mes text)
returns jsonb
language plpgsql
security invoker
stable
set search_path = public
as $$
declare
  v_fuso     text := 'America/Sao_Paulo';
  v_inicio   date;
  v_fim      date;
  v_primeiro date;
  v_ultimo   date;

  v_servico_centavos bigint;
  v_atendimentos     bigint;
  v_loja_centavos    bigint;
  v_vendas           bigint;

  v_servicos jsonb;
  v_produtos jsonb;
  v_meses    jsonb;
begin
  if p_mes !~ '^\d{4}-(0[1-9]|1[0-2])$' then
    raise exception 'mes deve estar no formato AAAA-MM';
  end if;

  v_inicio := (p_mes || '-01')::date;
  v_fim := (v_inicio + interval '1 month')::date;

  -- ---------- cartões do mês ----------

  select coalesce(sum(a.preco_centavos), 0), count(*)
  into v_servico_centavos, v_atendimentos
  from public.agendamentos a
  where a.estado = 'concluido'
    and a.data >= v_inicio
    and a.data < v_fim;

  select coalesce(sum(v.total_centavos), 0), count(*)
  into v_loja_centavos, v_vendas
  from public.vendas v
  where v.status = 'confirmada'
    and (v.criado_em at time zone v_fuso)::date >= v_inicio
    and (v.criado_em at time zone v_fuso)::date < v_fim;

  -- ---------- pizza 1: serviços do mês ----------
  -- Quantidade E dinheiro na mesma linha: o serviço mais pedido nem sempre é
  -- o que mais rende, e essa diferença é metade do que a tela tem a dizer.

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
      and a.data >= v_inicio
      and a.data < v_fim
    group by s.id, s.nome, s.cor
  ) t;

  -- ---------- pizza 2: produtos vendidos no mês ----------
  -- Agrupa por NOME, não por produto_id: o nome é o congelado na venda, e é
  -- o que a dona reconhece. Produto renomeado depois não some do passado.

  select coalesce(jsonb_agg(linha order by (linha->>'quantidade')::bigint desc), '[]'::jsonb)
  into v_produtos
  from (
    select jsonb_build_object(
             'nome', i.nome,
             'quantidade', sum(i.quantidade),
             'totalCentavos', sum(i.preco_centavos * i.quantidade)
           ) as linha
    from public.itens_venda i
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= v_inicio
      and (v.criado_em at time zone v_fuso)::date < v_fim
    group by i.nome
  ) t;

  -- ---------- série de todos os meses ----------
  -- Do primeiro movimento até o mês atual, SEM buraco: mês parado precisa
  -- aparecer como zero. Se ele sumisse da série, a barra do lado encostaria
  -- na seguinte e o gráfico contaria uma continuidade que não houve.

  select least(
           (select min(a.data) from public.agendamentos a where a.estado = 'concluido'),
           (select min((v.criado_em at time zone v_fuso)::date)
              from public.vendas v where v.status = 'confirmada')
         )
  into v_primeiro;

  if v_primeiro is null then
    v_meses := '[]'::jsonb;
  else
    v_ultimo := greatest(
      date_trunc('month', (now() at time zone v_fuso)::date)::date,
      v_inicio
    );

    select coalesce(jsonb_agg(linha order by linha->>'mes'), '[]'::jsonb)
    into v_meses
    from (
      select jsonb_build_object(
               'mes', to_char(m.mes, 'YYYY-MM'),
               'servicoCentavos', (
                 select coalesce(sum(a.preco_centavos), 0)
                 from public.agendamentos a
                 where a.estado = 'concluido'
                   and a.data >= m.mes
                   and a.data < (m.mes + interval '1 month')::date
               ),
               'lojaCentavos', (
                 select coalesce(sum(v.total_centavos), 0)
                 from public.vendas v
                 where v.status = 'confirmada'
                   and (v.criado_em at time zone v_fuso)::date >= m.mes
                   and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
               ),
               'atendimentos', (
                 select count(*)
                 from public.agendamentos a
                 where a.estado = 'concluido'
                   and a.data >= m.mes
                   and a.data < (m.mes + interval '1 month')::date
               )
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
    'mes', p_mes,
    'servicoCentavos', v_servico_centavos,
    'lojaCentavos', v_loja_centavos,
    'atendimentos', v_atendimentos,
    'vendas', v_vendas,
    'servicos', v_servicos,
    'produtos', v_produtos,
    'meses', v_meses
  );
end $$;

comment on function public.resumo_dashboard is
  'Números do dashboard: cartões do mês, serviços, produtos e a série de todos os meses. Serviço conta se concluído; venda conta se confirmada.';

revoke all on function public.resumo_dashboard(text) from public;
grant execute on function public.resumo_dashboard(text) to authenticated;

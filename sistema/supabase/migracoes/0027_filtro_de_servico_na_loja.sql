-- ============================================================
-- BARBOS — migração 0027: o filtro de serviço também vale para a loja
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0026. Pode rodar mais de uma vez.
--
-- ============================================================
-- O BUG QUE ISTO CONSERTA
-- ============================================================
--
-- No dashboard, escolher um serviço filtrava só metade da tela.
--
--   cartão SERVIÇOS  →  filtrado    (só os atendimentos de BARBA)
--   cartão LOJA      →  NÃO filtrado (todas as vendas do período)
--   TOTAL DO PERÍODO →  a soma dos dois, misturada
--
-- Quem pedia "quanto BARBA rendeu" recebia BARBA mais a mercearia
-- inteira, e o número não servia para comparar setor com setor.
--
-- O filtro de BARBEIRO já descia até a loja desde a 0016. O de
-- SERVIÇO nunca desceu. Não foi decisão: a condição do barbeiro está
-- escrita à mão em CINCO lugares (receita da loja com e sem filtro de
-- produto, a rosca de produtos, e os dois mesmos casos dentro da série
-- de meses), e a do serviço não foi para nenhum deles.
--
-- ============================================================
-- POR QUE UMA FUNÇÃO, E NÃO MAIS UMA CONDIÇÃO COLADA CINCO VEZES
-- ============================================================
--
-- Porque o bug É a repetição. Cinco cópias da mesma regra é como se
-- esquece uma delas — e desta vez esqueceram-se as cinco de uma só
-- dimensão. Colar agora a condição do serviço nas cinco deixaria o
-- próximo filtro com o mesmo destino.
--
-- `venda_no_recorte` passa a ser o único lugar onde se decide se uma
-- venda pertence ao recorte. O próximo filtro que descer para a loja
-- muda uma função, não faz uma caçada.
--
-- ============================================================
-- A REGRA, DITA POR EXTENSO
-- ============================================================
--
-- Sem filtro de serviço nem de barbeiro → toda venda entra.
--
-- Com qualquer um dos dois → só entra a venda pendurada num
-- agendamento que satisfaz TODOS os filtros ativos.
--
-- CONSEQUÊNCIA QUE PRECISA SER DITA: a compra AVULSA (a do balcão,
-- `agendamento_id` nulo) SAI do recorte quando há filtro de serviço ou
-- de barbeiro. Isso é proposital — ela não tem serviço nem barbeiro
-- para casar, e enfiá-la em todo recorte faria "BARBA" e "CABELO"
-- somarem o mesmo refrigerante duas vezes. Para vê-la, tire os
-- filtros de serviço e barbeiro; ela continua no recorte por período.
--
-- Isso já valia para o filtro de barbeiro desde a 0016. A mudança aqui
-- é o serviço passar a se comportar igual.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A regra, num lugar só
-- ------------------------------------------------------------
-- `stable` e não `immutable`: ela lê `agendamentos`, e o resultado
-- muda se o agendamento mudar de barbeiro. `immutable` autorizaria o
-- Postgres a guardar o resultado e devolver número velho.
--
-- `security invoker`: o RLS de `agendamentos` já limita à barbearia
-- logada, como no resto do resumo. `definer` aqui deixaria uma venda
-- ser testada contra o agendamento de outra barbearia.

create or replace function public.venda_no_recorte(
  p_agendamento_id uuid,
  p_servico_ids uuid[],
  p_barbeiro_ids uuid[]
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    -- Nenhum dos dois filtros ativo: passa tudo, inclusive avulsa.
    when coalesce(cardinality(p_servico_ids), 0) = 0
     and coalesce(cardinality(p_barbeiro_ids), 0) = 0
    then true
    -- Algum ativo: precisa de um agendamento que case com TODOS eles.
    -- Venda avulsa tem `p_agendamento_id` nulo, o exists dá falso, e ela
    -- fica de fora — que é o que se quer.
    else exists (
      select 1
      from public.agendamentos a
      where a.id = p_agendamento_id
        and (coalesce(cardinality(p_servico_ids), 0) = 0
             or a.servico_id = any (p_servico_ids))
        and (coalesce(cardinality(p_barbeiro_ids), 0) = 0
             or a.barbeiro_id = any (p_barbeiro_ids))
    )
  end
$$;

comment on function public.venda_no_recorte is
  'A venda pertence ao recorte de serviço/barbeiro? Sem filtro, tudo entra; com filtro, só a venda de um agendamento que case com todos. Avulsa fica de fora.';

revoke all on function public.venda_no_recorte(uuid, uuid[], uuid[]) from public;
grant execute on function public.venda_no_recorte(uuid, uuid[], uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 2. O resumo passa a usá-la nos cinco lugares
-- ------------------------------------------------------------
-- Mesma assinatura e mesmo corpo da 0026. A única diferença: as cinco
-- cópias de
--
--   and (not v_filtra_barbeiro or exists (select 1 from agendamentos a
--        where a.id = v.agendamento_id and a.barbeiro_id = any (...)))
--
-- viraram
--
--   and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids)
--
-- Os blocos que somam AGENDAMENTOS continuam com as condições à mão:
-- lá o filtro é direto na linha, não através de uma venda.

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
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;
  v_filtra_produto := p_produto_ids is not null and cardinality(p_produto_ids) > 0;

  if not coalesce(p_so_loja, false) then
    select coalesce(sum(a.preco_centavos), 0), count(*)
    into v_servico_centavos, v_atendimentos
    from public.agendamentos a
    where a.estado = 'concluido'
      and a.data >= p_inicio
      and a.data < p_fim
      and (not v_filtra_servico or a.servico_id = any (p_servico_ids))
      and (not v_filtra_barbeiro or a.barbeiro_id = any (p_barbeiro_ids));
  end if;

  -- Com filtro de produto: soma as LINHAS, não o total da venda inteira.
  if v_filtra_produto then
    select coalesce(sum(i.preco_centavos * i.quantidade), 0),
           count(distinct v.id)
    into v_loja_centavos, v_vendas
    from public.itens_venda i
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and i.produto_id = any (p_produto_ids)
      and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids);
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas_no_caixa v
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids);
  end if;

  if not coalesce(p_so_loja, false) then
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
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids)
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
                 when coalesce(p_so_loja, false) then 0
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
                 when v_filtra_produto then (
                   select coalesce(sum(i.preco_centavos * i.quantidade), 0)
                   from public.itens_venda i
                   join public.vendas_no_caixa v on v.id = i.venda_id
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids)
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas_no_caixa v
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and public.venda_no_recorte(v.agendamento_id, p_servico_ids, p_barbeiro_ids)
                 )
               end,
               'atendimentos', case
                 when coalesce(p_so_loja, false) then 0
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
  'Números do dashboard no intervalo [inicio, fim). Serviço e barbeiro filtram os dois lados: atendimentos e vendas da loja (via venda_no_recorte).';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;


-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   -- 1. Sem filtro, a loja soma tudo do mês:
--   select (public.resumo_dashboard('2026-09-01','2026-10-01')->>'lojaCentavos')::bigint;
--
--   -- 2. Com um serviço qualquer, tem que DIMINUIR (ou zerar), nunca
--   --    repetir o número de cima:
--   select (public.resumo_dashboard(
--             '2026-09-01','2026-10-01',
--             array[(select id from public.servicos limit 1)]
--           )->>'lojaCentavos')::bigint;
--
-- Antes desta migração os dois davam igual — era o bug.
--
-- Na tela: Filtros → Serviços → escolha um → Aplicar. O cartão LOJA
-- tem que mudar junto com o de SERVIÇOS, e o TOTAL DO PERÍODO passa a
-- ser a soma de duas metades do mesmo recorte.
-- ------------------------------------------------------------

-- ============================================================
-- BARBOS — migração 0017: filtro de produtos da loja no dashboard
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0016. Pode rodar mais de uma vez.
--
-- Acrescenta `p_produto_ids`: quando informado, a receita da loja e a pizza
-- de produtos consideram só esses itens (mesma regra da vitrine na UI).
-- ============================================================

drop function if exists public.resumo_dashboard(date, date, uuid[], uuid[], boolean);

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
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and i.produto_id = any (p_produto_ids)
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas v
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      );
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
    join public.vendas v on v.id = i.venda_id
    where v.status = 'confirmada'
      and (v.criado_em at time zone v_fuso)::date >= p_inicio
      and (v.criado_em at time zone v_fuso)::date < p_fim
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and (
        not v_filtra_barbeiro
        or exists (
          select 1 from public.agendamentos a
          where a.id = v.agendamento_id
            and a.barbeiro_id = any (p_barbeiro_ids)
        )
      )
    group by i.nome
  ) t;

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
                   join public.vendas v on v.id = i.venda_id
                   where v.status = 'confirmada'
                     and (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas v
                   where v.status = 'confirmada'
                     and (v.criado_em at time zone v_fuso)::date >= m.mes
                     and (v.criado_em at time zone v_fuso)::date < (m.mes + interval '1 month')::date
                     and (
                       not v_filtra_barbeiro
                       or exists (
                         select 1 from public.agendamentos a
                         where a.id = v.agendamento_id
                           and a.barbeiro_id = any (p_barbeiro_ids)
                       )
                     )
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
  'Números do dashboard no intervalo [inicio, fim). Filtros: serviços, barbeiros, produtos, só loja.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;

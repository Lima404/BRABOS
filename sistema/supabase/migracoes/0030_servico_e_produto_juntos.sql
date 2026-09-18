-- ============================================================
-- BARBOS — migração 0030: serviço E produto juntos é pedido válido
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0029. Pode rodar mais de uma vez.
--
-- ============================================================
-- O QUE A 0028 E A 0029 ERRARAM JUNTAS
-- ============================================================
--
-- Cada uma sozinha estava certa:
--
--   marcou só serviço  ->  a loja sai   (0028)
--   marcou só produto  ->  a cadeira sai (0029)
--
-- Somadas, proibiram um pedido legítimo. Marcar CABELO + BARBA e
-- ENERGETICO devolvia ZERO nos dois cartões, e o diálogo avisava que
-- "serviço e produto se anulam" — como se a pessoa tivesse pedido algo
-- impossível. Não tinha: ela quis as duas coisas.
--
-- O erro foi ler "marquei serviço" como "só quero serviço". O que a
-- marca diz é "quero ESTE serviço". Quem dispensa a loja não é a marca
-- no serviço — é a AUSÊNCIA de marca do outro lado.
--
-- ============================================================
-- A REGRA, CORRIGIDA
-- ============================================================
--
-- **Um lado só desaparece quando o OUTRO foi escolhido sozinho.**
--
--   marcou serviço, produto limpo   ->  serviços filtrados, loja = 0
--   marcou produto, serviço limpo   ->  loja filtrada, serviços = 0
--   marcou os DOIS                  ->  os dois, cada um filtrado
--   não marcou nada                 ->  os dois, inteiros
--   marcou barbeiro                 ->  os dois lados, filtrados por ele
--
-- Continua valendo que serviço e produto são DE ONDE O DINHEIRO VEM, e
-- que barbeiro é PESSOA e por isso filtra os dois lados sem zerar nada.
--
-- ============================================================
-- SOBRA UMA CONTRADIÇÃO DE VERDADE
-- ============================================================
--
-- "Só movimentações da loja" + serviço marcado. Aí não é pedido duplo,
-- é ordem contrária: a caixa manda esconder os serviços e a marca manda
-- mostrar aqueles serviços. O recorte volta zerado e o diálogo avisa —
-- mas agora avisa SÓ nesse caso, não mais quando há produto marcado.
-- ============================================================


-- ------------------------------------------------------------
-- Duas variáveis, uma para cada lado
-- ------------------------------------------------------------
-- `v_sem_servicos` já existia (0029) e ganha a ressalva do "sozinho".
-- `v_sem_loja` nasce aqui e substitui o `v_filtra_servico` que a 0028
-- tinha colocado nos três guardas do lado da loja.
--
-- Mesma assinatura e mesmo corpo da 0029. Os quatro blocos que somam
-- AGENDAMENTOS não mudaram: lá o filtro é na linha, pelo serviço dela.

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
  v_sem_loja        boolean;
begin
  if p_inicio is null or p_fim is null or p_fim <= p_inicio then
    raise exception 'intervalo inválido: inicio < fim (fim exclusivo)';
  end if;

  v_filtra_servico := p_servico_ids is not null and cardinality(p_servico_ids) > 0;
  v_filtra_barbeiro := p_barbeiro_ids is not null and cardinality(p_barbeiro_ids) > 0;
  v_filtra_produto := p_produto_ids is not null and cardinality(p_produto_ids) > 0;

  -- Marcar produto e pedir a PRATELEIRA: quem quer saber quanto o
  -- energetico rendeu nao esta perguntando quanto renderam os cortes.
  -- Um lado so desaparece quando o OUTRO foi escolhido SOZINHO. Marcar
  -- servico E produto nao e contradicao: e pedir as duas coisas, cada
  -- uma recortada pelo que foi marcado nela.
  v_sem_servicos := coalesce(p_so_loja, false)
                    or (v_filtra_produto and not v_filtra_servico);
  v_sem_loja     := v_filtra_servico and not v_filtra_produto;

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
  if v_sem_loja then
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
      and not v_sem_loja
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
                 when v_sem_loja then 0
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
  'Numeros do dashboard no intervalo [inicio, fim). Um lado so some quando o outro foi marcado sozinho; marcar servico E produto traz os dois. Barbeiro filtra os dois lados.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;

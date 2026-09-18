-- ============================================================
-- BARBOS — migração 0028: filtro de serviço é "só a cadeira"
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0027. Pode rodar mais de uma vez.
--
-- ============================================================
-- O QUE MUDA, E POR QUE ISTO CORRIGE A 0027
-- ============================================================
--
-- A 0027 fez o filtro de serviço descer até a loja: escolher
-- CABELO + BARBA passava a mostrar, no cartão LOJA, o que os clientes
-- DAQUELE serviço consumiram. Era coerente, e não era o que se queria.
--
-- O que se quer é mais simples: **escolher um serviço é escolher a
-- cadeira.** A loja sai inteira do recorte — cartão LOJA em zero, rosca
-- de produtos vazia, série de meses sem a parcela da loja.
--
-- Isso não é uma regra nova: é o ESPELHO da que já existia. O filtro
-- "Só movimentações da loja" (`p_so_loja`) zera os serviços desde a
-- 0016. Faltava o outro lado do par.
--
--   Só loja           →  serviços = 0
--   Filtro de serviço →  loja = 0
--
-- ============================================================
-- O QUE CONTINUA COMO ESTAVA
-- ============================================================
--
-- O filtro de BARBEIRO segue valendo para os dois lados: com um
-- barbeiro escolhido, o cartão LOJA mostra o que foi lançado nos
-- atendimentos dele. Barbeiro e serviço são coisas diferentes — o
-- barbeiro é uma PESSOA, e tanto o corte quanto o refrigerante passam
-- pela mão dela; o serviço é o que a cadeira faz, e a prateleira não
-- faz serviço nenhum.
--
-- Se um dia o barbeiro também tiver que zerar a loja, o lugar é o
-- mesmo `if` desta migração.
--
-- ============================================================
-- COMBINAÇÃO SEM RESPOSTA: "só loja" + filtro de serviço
-- ============================================================
--
-- Os dois juntos se anulam: um esconde os serviços, o outro esconde a
-- loja, e o recorte fica vazio. O banco não adivinha qual dos dois a
-- pessoa quis — devolve zero nos dois cartões, que é a resposta
-- honesta. Quem evita a armadilha é a tela, avisando antes.
--
-- ============================================================
-- A FUNÇÃO PERDE UM PARÂMETRO
-- ============================================================
--
-- `venda_no_recorte` tinha três argumentos; fica com dois. Com filtro
-- de serviço a loja nem é consultada, então `p_servico_ids` ali virou
-- parâmetro morto — e parâmetro morto numa função de regra é o que faz
-- o próximo leitor acreditar numa regra que não existe mais.
--
-- Precisa de `drop` antes do `create`: mudar a lista de argumentos cria
-- uma SOBRECARGA em vez de substituir, e duas candidatas com o mesmo
-- nome viram erro de ambiguidade quando o PostgREST escolhe pelo nome
-- dos argumentos.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A regra da loja, agora só sobre barbeiro
-- ------------------------------------------------------------

drop function if exists public.venda_no_recorte(uuid, uuid[], uuid[]);

create or replace function public.venda_no_recorte(
  p_agendamento_id uuid,
  p_barbeiro_ids uuid[]
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    -- Sem filtro de barbeiro: passa tudo, inclusive a compra avulsa.
    when coalesce(cardinality(p_barbeiro_ids), 0) = 0 then true
    -- Com filtro: precisa estar pendurada num atendimento daquele
    -- barbeiro. A avulsa tem agendamento nulo, o exists dá falso, e ela
    -- fica de fora — ela não tem barbeiro para casar.
    else exists (
      select 1
      from public.agendamentos a
      where a.id = p_agendamento_id
        and a.barbeiro_id = any (p_barbeiro_ids)
    )
  end
$$;

comment on function public.venda_no_recorte is
  'A venda pertence ao recorte de barbeiro? Sem filtro, tudo entra; com filtro, só a venda de um atendimento daquele barbeiro. Avulsa fica de fora.';

revoke all on function public.venda_no_recorte(uuid, uuid[]) from public;
grant execute on function public.venda_no_recorte(uuid, uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 2. O resumo: filtro de serviço zera a loja
-- ------------------------------------------------------------
-- Mesma assinatura e mesmo corpo da 0027, com quatro diferenças, todas
-- no lado da loja:
--
--   1. a receita da loja ganha um primeiro ramo `if v_filtra_servico`
--      que devolve zero sem consultar vendas;
--   2. a rosca de produtos ganha `and not v_filtra_servico`;
--   3. a série de meses ganha `when v_filtra_servico then 0`;
--   4. as cinco chamadas a `venda_no_recorte` perdem `p_servico_ids`.
--
-- Os blocos que somam AGENDAMENTOS não mudaram uma vírgula.

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
  'Números do dashboard no intervalo [inicio, fim). Filtro de serviço zera a loja (espelho do "só loja"); filtro de barbeiro vale para os dois lados.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;


-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   -- sem filtro: a loja soma o mês inteiro
--   select (public.resumo_dashboard('2026-09-01','2026-10-01')->>'lojaCentavos')::bigint;
--
--   -- com um serviço: TEM QUE SER 0, e 'produtos' tem que vir []
--   select public.resumo_dashboard(
--            '2026-09-01','2026-10-01',
--            array[(select id from public.servicos limit 1)]
--          ) -> 'produtos';
--
-- Na tela: Filtros → Serviços → CABELO + BARBA → Aplicar. O cartão LOJA
-- vai a R$ 0,00 e a rosca "Produtos vendidos" diz que a loja ficou de
-- fora do recorte.
-- ------------------------------------------------------------

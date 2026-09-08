-- ============================================================
-- BARBOS — migração 0026: a compra lançada num atendimento só
--                          entra no caixa quando ele é concluído
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0009, 0011 e 0017. Pode rodar mais de uma vez.
--
-- ============================================================
-- O BUG QUE ISTO CONSERTA
-- ============================================================
--
-- Lançar um refrigerante na comanda de um agendamento gravava a venda
-- como 'confirmada' na hora. O dashboard soma `status = 'confirmada'`
-- sem olhar o agendamento, então o dinheiro aparecia no caixa com o
-- cliente ainda marcado como "Agendado" — antes de sentar na cadeira.
--
-- Pior: apagar o agendamento não tirava o dinheiro de lá. A coluna
-- `vendas.agendamento_id` era `on delete set null`, e venda com
-- agendamento nulo é exatamente como uma compra AVULSA se parece. A
-- venda pendurada num atendimento que foi apagado virava, sozinha,
-- receita de balcão.
--
-- ============================================================
-- A REGRA NOVA — e por que ela é derivada, não gravada
-- ============================================================
--
--   venda avulsa (agendamento_id null)  → entra no caixa na hora
--   venda de um atendimento             → entra quando ele conclui
--
-- A tentação era criar um status 'pendente' e virar pra 'confirmada'
-- num gatilho do "Concluir". Não foi feito assim: status gravado
-- DESANDA. Basta o barbeiro concluir sem querer e voltar o estado pra
-- 'agendado' que a venda fica 'confirmada' pra sempre, contando um
-- dinheiro que a agenda diz que não entrou — e ninguém percebe, porque
-- o número está certo em um lugar e errado no outro.
--
-- Aqui só existe uma fonte da verdade: o estado do agendamento. A view
-- `vendas_no_caixa` faz a pergunta na hora de somar. Concluir passa a
-- contar, desconcluir para de contar, e não há nada pra ficar fora de
-- sincronia porque não há nada duplicado.
--
-- ============================================================
-- O QUE MUDA NOS NÚMEROS QUE VOCÊ JÁ TEM
-- ============================================================
--
-- Toda venda hoje pendurada num agendamento NÃO concluído sai do
-- balanço na hora em que esta migração roda. Ela volta assim que o
-- atendimento for concluído. Venda avulsa não se mexe.
--
-- Para ver antes de rodar quanto vai sair do caixa:
--
--   select count(*) as vendas,
--          sum(v.total_centavos) / 100.0 as reais
--   from public.vendas v
--   join public.agendamentos a on a.id = v.agendamento_id
--   where v.status = 'confirmada'
--     and a.estado <> 'concluido';
--
-- O MÊS da venda continua sendo o de `criado_em` (quando foi lançada),
-- não o da conclusão. Concluir hoje um atendimento de ontem faz o
-- número de ONTEM crescer, e é o certo: o refrigerante saiu ontem.
-- ============================================================


-- ------------------------------------------------------------
-- 1. A regra, num lugar só
-- ------------------------------------------------------------
-- Uma view e não uma condição repetida: `resumo_dashboard` soma vendas
-- em SEIS lugares (cartão, pizza de produtos, série de meses, e as
-- variantes com filtro de produto). Seis cópias da mesma regra é como
-- se descobre, meses depois, que uma delas não foi atualizada junto.
--
-- `security_invoker = on`: a view lê com o RLS de quem chamou, não com
-- o de quem a criou. Sem isso ela seria um buraco por onde uma
-- barbearia leria a venda da outra.

create or replace view public.vendas_no_caixa
with (security_invoker = on) as
select v.*
from public.vendas v
where v.status = 'confirmada'
  and (
    -- Compra avulsa: ninguém precisa concluir nada. É o balcão, é para
    -- isso que a loja do QR existe.
    v.agendamento_id is null
    or exists (
      select 1
      from public.agendamentos a
      where a.id = v.agendamento_id
        and a.estado = 'concluido'
    )
  );

comment on view public.vendas_no_caixa is
  'As vendas que contam como receita: avulsas, e as de atendimento concluído. Regra única do caixa.';

-- Só a dona logada. `anon` fica de fora de propósito: a loja pública
-- não soma caixa nenhum, e o faturamento da barbearia não tem por que
-- estar ao alcance de quem só leu o QR code.
revoke all on public.vendas_no_caixa from public;
grant select on public.vendas_no_caixa to authenticated;


-- ------------------------------------------------------------
-- 2. Apagar o agendamento não pode deixar a venda solta
-- ------------------------------------------------------------
-- `on delete set null` era o contrário do que se queria: apagava a
-- ligação e deixava a venda com cara de avulsa, que é justamente a que
-- conta sem perguntar nada. O caminho normal (o botão Excluir) nem
-- chega aqui — a função da parte 3 apaga as vendas antes. Isto é a
-- rede de baixo, para quando alguém apagar a linha direto no painel do
-- Supabase: melhor a venda sumir junto do que virar receita fantasma.

alter table public.vendas
  drop constraint if exists vendas_agendamento_id_fkey;

alter table public.vendas
  add constraint vendas_agendamento_id_fkey
    foreign key (agendamento_id)
    references public.agendamentos(id)
    on delete cascade;

comment on column public.vendas.agendamento_id is
  'Agendamento a que a compra foi lançada. Nulo = compra avulsa (balcão). Apagar o agendamento apaga a venda.';


-- ------------------------------------------------------------
-- 3. Excluir agendamento: devolve o consumo à prateleira
-- ------------------------------------------------------------
-- Excluir é diferente de cancelar. Cancelar (`estado = 'cancelado'`)
-- guarda a linha, porque "fulano desmarcou" é fato do negócio. Excluir
-- diz "isto nunca deveria ter existido" — e então o que foi lançado
-- dentro dele também não existiu: as unidades voltam pro estoque e as
-- vendas somem.
--
-- Tudo numa função só porque são três escritas que precisam cair
-- juntas. Em três chamadas separadas, uma falha no meio deixaria o
-- estoque contando unidades que ninguém tirou da prateleira.
--
-- `security definer`: `vendas` e `itens_venda` só têm política de
-- SELECT (0007). Como invoker, o delete não daria erro — apagaria
-- ZERO linhas em silêncio, que é o pior resultado possível. Por isso o
-- dono é conferido na mão, logo abaixo.

create or replace function public.excluir_agendamento(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia  uuid;
  v_unidades   bigint := 0;
  v_centavos   bigint := 0;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'erro', 'Sua sessão expirou. Entre de novo.');
  end if;

  -- `for update` segura a linha: sem isso, um "Concluir" disparado do
  -- celular no mesmo segundo poderia entrar entre a devolução do
  -- estoque e o delete.
  select a.barbearia_id into v_barbearia
  from public.agendamentos a
  where a.id = p_id
  for update;

  if v_barbearia is null then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento já não existe. Recarregue a página.');
  end if;

  if v_barbearia <> auth.uid() then
    return jsonb_build_object('ok', false, 'erro', 'Esse agendamento não é desta barbearia.');
  end if;

  -- Quanto vai voltar. Serve para a mensagem na tela e para pular o
  -- update quando não houve consumo nenhum.
  select coalesce(sum(i.quantidade), 0),
         coalesce(sum(i.preco_centavos * i.quantidade), 0)
  into v_unidades, v_centavos
  from public.itens_venda i
  join public.vendas v on v.id = i.venda_id
  where v.agendamento_id = p_id
    and v.barbearia_id = v_barbearia;

  if v_unidades > 0 then
    -- O `group by` não é enfeite: o mesmo produto pode ter sido lançado
    -- em duas vendas do mesmo atendimento (cada lançamento vira uma
    -- venda, ver 0011). Sem agrupar, o UPDATE ... FROM casaria duas
    -- linhas com a mesma linha de `produtos` e o Postgres aplicaria só
    -- UMA delas — o segundo refrigerante nunca voltaria à prateleira.
    update public.produtos p
    set unidades = p.unidades + d.quantidade
    from (
      select i.produto_id, sum(i.quantidade) as quantidade
      from public.itens_venda i
      join public.vendas v on v.id = i.venda_id
      where v.agendamento_id = p_id
        and v.barbearia_id = v_barbearia
      group by i.produto_id
    ) d
    where p.id = d.produto_id
      and p.barbearia_id = v_barbearia;
  end if;

  -- As vendas do atendimento. `itens_venda` desce junto por cascade
  -- (0007). O cascade da parte 2 faria isso sozinho no delete abaixo,
  -- mas apagar aqui deixa a ordem explícita para quem for ler depois.
  delete from public.vendas
  where agendamento_id = p_id
    and barbearia_id = v_barbearia;

  delete from public.agendamentos
  where id = p_id;

  return jsonb_build_object(
    'ok', true,
    'unidadesDevolvidas', v_unidades,
    'centavosDevolvidos', v_centavos
  );
end $$;

comment on function public.excluir_agendamento is
  'Apaga o agendamento, apaga as vendas lançadas nele e devolve as unidades ao estoque. Tudo ou nada.';

revoke all on function public.excluir_agendamento(uuid) from public;
grant execute on function public.excluir_agendamento(uuid) to authenticated;


-- ------------------------------------------------------------
-- 4. O dashboard passa a ler pela view
-- ------------------------------------------------------------
-- Mesma assinatura e mesmo corpo da 0017. A ÚNICA diferença: onde
-- estava `from public.vendas v where v.status = 'confirmada'` agora
-- está `from public.vendas_no_caixa v` — a view já carrega o status e
-- a regra do atendimento concluído.

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
    from public.vendas_no_caixa v
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
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
    join public.vendas_no_caixa v on v.id = i.venda_id
    where (v.criado_em at time zone v_fuso)::date >= p_inicio
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
                   from public.vendas_no_caixa v
                   where (v.criado_em at time zone v_fuso)::date >= m.mes
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
  'Números do dashboard no intervalo [inicio, fim). Loja conta pela view vendas_no_caixa: avulsa entra na hora, a de atendimento entra quando ele conclui.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;


-- ------------------------------------------------------------
-- Conferir depois de rodar:
--
--   -- as que estão esperando um atendimento concluir:
--   select a.cliente_nome, a.data, a.estado, v.total_centavos / 100.0 as reais
--   from public.vendas v
--   join public.agendamentos a on a.id = v.agendamento_id
--   where v.status = 'confirmada'
--     and a.estado <> 'concluido'
--   order by a.data;
--
--   -- e o que o caixa enxerga (não pode conter nenhuma das de cima):
--   select count(*), sum(total_centavos) / 100.0 as reais
--   from public.vendas_no_caixa;
--
-- Depois, no sistema: lance um produto num agendamento "Agendado" e
-- veja o dashboard NÃO mexer. Toque em Concluir e veja o valor entrar.
-- ------------------------------------------------------------

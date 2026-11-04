-- ============================================================
-- BARBOS — migração 0040: registro manual do dia
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0026, 0028 e 0030. Pode rodar mais de uma vez.
--
-- ============================================================
-- POR QUE ISTO EXISTE
-- ============================================================
--
-- Há barbearia que não quer agenda. O dono fecha o dia e anota: "o
-- GABRIEL fez 5 cabelos, 4 barbas e 6 cabelo+barba; a DAIANNE fez 3, 7 e
-- 8; saíram 12 energéticos". Ele quer o dashboard, não o agendamento.
--
-- ============================================================
-- A DECISÃO: LANÇAMENTO PRÓPRIO, NÃO AGENDAMENTO DE MENTIRA
-- ============================================================
--
-- A tentação era gravar cada corte como um `agendamento` 'concluido' — aí
-- o dashboard não mudaria em nada. Foi descartado, e vale saber por quê,
-- porque de longe parece o caminho barato:
--
--   * `agendamentos` tem `unique (barbearia_id, data, horario)` e a trava
--     gist da 0015. 33 cortes num dia precisariam de 33 horários
--     inventados que não se sobrepõem — e a trava recusaria quase todos.
--   * `cliente_nome` é `not null`: entrariam 33 clientes chamados
--     "Registro manual".
--   * `agenda_publica` monta os horários OCUPADOS a partir de
--     `agendamentos`. Os cortes inventados fechariam horários de verdade
--     na tela pública de quem usa as duas coisas.
--
-- Ou seja: o atalho vazaria para a agenda, para a comanda e para a tela
-- pública. O lançamento manual NÃO é um horário marcado — é a contagem do
-- dia. Tabela própria, e uma VIEW junta as duas no único lugar que precisa
-- enxergar as duas: o dashboard.
--
-- É exatamente o que a 0026 fez com `vendas_no_caixa`. Mesma ideia, outro
-- lado do balcão.
--
-- ============================================================
-- A LOJA É DIFERENTE: VENDA MANUAL É VENDA DE VERDADE
-- ============================================================
--
-- Serviço manual é contagem; venda manual é VENDA. Ela entra em `vendas` e
-- `itens_venda` como qualquer outra, baixa o estoque como qualquer outra, e
-- `vendas_no_caixa` a enxerga sem uma linha de código novo. Inventar um
-- segundo lugar para guardar venda seria criar a divergência que a 0026
-- existe para evitar.
--
-- Duas colunas novas em `vendas` dão conta: `dia_manual` (o dia que o dono
-- declarou, que não é o dia em que ele digitou) e `barbeiro_id` (quem
-- vendeu, que até aqui só existia pendurado no agendamento).
-- ============================================================


-- ------------------------------------------------------------
-- 1. A contagem de serviços do dia
-- ------------------------------------------------------------

create table if not exists public.registros_servico_manual (
  id             uuid primary key default gen_random_uuid(),
  barbearia_id   uuid not null default auth.uid()
                   references public.barbearias(id) on delete cascade,
  -- O dia DECLARADO. Fechar o caixa de sexta no sábado de manhã é o uso
  -- normal, então a data nunca sai de `criado_em`.
  data           date not null,
  -- `restrict` igual ao `agendamentos.barbeiro_id` da 0015: barbeiro com
  -- movimento lançado não some, senão o faturamento de um mês fechado
  -- muda sozinho quando alguém arruma a equipe.
  barbeiro_id    uuid not null
                   references public.barbeiros(id) on delete restrict,
  servico_id     uuid not null
                   references public.servicos(id) on delete restrict,
  quantidade     integer not null check (quantidade between 1 and 999),
  -- Congelado, igual ao `agendamentos.preco_centavos` e ao
  -- `itens_venda.preco_centavos`: reajuste de tabela não reescreve mês
  -- fechado.
  preco_centavos integer not null check (preco_centavos >= 0),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),

  -- UMA linha por dia, barbeiro e serviço. É o que faz "reabrir e
  -- corrigir" ser possível: sem isso, salvar duas vezes dobraria o dia e
  -- não haveria como saber qual das duas linhas está certa.
  constraint registro_manual_unico
    unique (barbearia_id, data, barbeiro_id, servico_id)
);

comment on table public.registros_servico_manual is
  'Contagem de serviços lancada a mao no fim do dia. Nao e agendamento: nao tem horario, nao ocupa cadeira e nao aparece na agenda.';

create index if not exists registros_servico_manual_data_idx
  on public.registros_servico_manual (barbearia_id, data);

drop trigger if exists tocar_registros_servico_manual on public.registros_servico_manual;
create trigger tocar_registros_servico_manual
  before update on public.registros_servico_manual
  for each row execute function public.tocar_atualizado_em();

alter table public.registros_servico_manual enable row level security;

drop policy if exists "registro manual da propria barbearia"
  on public.registros_servico_manual;
create policy "registro manual da propria barbearia"
  on public.registros_servico_manual
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());


-- ------------------------------------------------------------
-- 2. A venda ganha dia declarado e dono
-- ------------------------------------------------------------

alter table public.vendas
  add column if not exists dia_manual date;

comment on column public.vendas.dia_manual is
  'Dia declarado no registro manual. Nulo = venda normal, e ai o dia vem de criado_em.';

alter table public.vendas
  add column if not exists barbeiro_id uuid
    references public.barbeiros(id) on delete restrict;

comment on column public.vendas.barbeiro_id is
  'Quem vendeu, quando a venda nao passa por agendamento. Nulo = balcao.';

-- Uma venda manual por dia e por barbeiro. `nulls not distinct` porque o
-- balcão (barbeiro nulo) também é UM: sem isso, cada salvada do balcão
-- criaria uma venda nova e o dia nunca seria corrigível.
create unique index if not exists vendas_registro_manual_unico
  on public.vendas (barbearia_id, dia_manual, barbeiro_id)
  nulls not distinct
  where dia_manual is not null;

create index if not exists vendas_dia_manual_idx
  on public.vendas (barbearia_id, dia_manual)
  where dia_manual is not null;


-- ------------------------------------------------------------
-- 3. `vendas_no_caixa` passa a dizer EM QUE DIA a venda conta
-- ------------------------------------------------------------
--
-- Era a `resumo_dashboard` que convertia `criado_em` para o fuso da
-- barbearia, em ONZE lugares. Agora a conversão mora na view, junto com a
-- regra do dia declarado — e os onze lugares leem uma coluna.
--
-- Sem isto, registrar na segunda o movimento do sábado jogaria o dinheiro
-- do sábado no dia da digitação.

drop view if exists public.vendas_no_caixa;

create view public.vendas_no_caixa
with (security_invoker = on) as
select
  v.*,
  coalesce(
    v.dia_manual,
    (v.criado_em at time zone 'America/Sao_Paulo')::date
  ) as data_caixa
from public.vendas v
where v.status = 'confirmada'
  and (
    v.agendamento_id is null
    or exists (
      select 1
      from public.agendamentos a
      where a.id = v.agendamento_id
        and a.estado = 'concluido'
    )
  );

comment on view public.vendas_no_caixa is
  'As vendas que contam como receita: avulsas, manuais e as de atendimento concluido. `data_caixa` e o dia em que cada uma conta.';

revoke all on public.vendas_no_caixa from public;
grant select on public.vendas_no_caixa to authenticated;


-- ------------------------------------------------------------
-- 4. `servicos_no_caixa`: o atendimento e a contagem, lado a lado
-- ------------------------------------------------------------
--
-- A irmã de `vendas_no_caixa` do lado da cadeira. Existe para que o
-- dashboard não precise saber que há duas origens — e para que a regra
-- não seja escrita nos QUATRO lugares em que ele soma serviço.
--
-- `generate_series` expande a contagem em uma linha por corte DE PROPÓSITO:
-- assim `count(*)` e `sum(preco_centavos)` continuam valendo sem mudar
-- uma única expressão de soma lá dentro. Trinta linhas por dia não é
-- volume para Postgres nenhum.
--
-- `id` não entra: expandida, a mesma linha apareceria várias vezes com o
-- mesmo id, e uma coluna que parece chave e não é vira bug de quem chegar
-- depois.

create or replace view public.servicos_no_caixa
with (security_invoker = on) as
select
  a.barbearia_id,
  a.data,
  a.servico_id,
  a.barbeiro_id,
  a.preco_centavos
from public.agendamentos a
where a.estado = 'concluido'

union all

select
  r.barbearia_id,
  r.data,
  r.servico_id,
  r.barbeiro_id,
  r.preco_centavos
from public.registros_servico_manual r
cross join generate_series(1, r.quantidade);

comment on view public.servicos_no_caixa is
  'Os servicos que contam como receita: atendimento concluido (0002) e contagem manual (0040), uma linha por corte. Regra unica da cadeira.';

revoke all on public.servicos_no_caixa from public;
grant select on public.servicos_no_caixa to authenticated;


-- ------------------------------------------------------------
-- 5. O recorte de barbeiro passa a enxergar a venda sem agendamento
-- ------------------------------------------------------------
--
-- Até aqui a única forma de uma venda ter dono era estar pendurada num
-- agendamento. A venda manual tem dono direto, e sem esta mudança ela
-- sumiria do dashboard no instante em que alguém filtrasse por barbeiro —
-- o que é justamente o que o dono vai fazer depois de lançar por barbeiro.
--
-- A versão de DOIS argumentos é APAGADA, não deixada ao lado. Duas
-- sobrecargas com o mesmo nome fazem o PostgREST responder "function is
-- not unique" e derrubam quem chamar por nome de argumento (foi o que
-- aconteceu na 0037).

-- A de DOIS argumentos (0028) é a que está no ar. A de TRÊS da 0027 já
-- foi derrubada lá, mas some aqui de novo por garantia: num banco que
-- tenha parado na 0027 ela conviveria com a nova — que também tem três
-- argumentos — e aí nenhuma das duas seria chamável por nome.
drop function if exists public.venda_no_recorte(uuid, uuid[], uuid[]);
drop function if exists public.venda_no_recorte(uuid, uuid[]);

create or replace function public.venda_no_recorte(
  p_agendamento_id uuid,
  p_barbeiro_id uuid,
  p_barbeiro_ids uuid[]
)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select case
    -- Sem filtro, tudo entra.
    when coalesce(cardinality(p_barbeiro_ids), 0) = 0 then true
    -- Dono direto (venda manual) manda: nem olha o agendamento.
    when p_barbeiro_id is not null then p_barbeiro_id = any (p_barbeiro_ids)
    -- Caminho antigo: o dono vem do atendimento.
    else exists (
      select 1
      from public.agendamentos a
      where a.id = p_agendamento_id
        and a.barbeiro_id = any (p_barbeiro_ids)
    )
  end
$$;

comment on function public.venda_no_recorte is
  'A venda pertence ao recorte de barbeiro? Sem filtro, tudo entra. Com filtro: vale o barbeiro da propria venda (0040) e, na falta dele, o do atendimento (0028). Venda de balcao fica de fora.';

revoke all on function public.venda_no_recorte(uuid, uuid, uuid[]) from public;
grant execute on function public.venda_no_recorte(uuid, uuid, uuid[]) to authenticated;


-- ------------------------------------------------------------
-- 6. `resumo_dashboard` lê as duas views
-- ------------------------------------------------------------
--
-- Mesma assinatura e mesmo corpo da 0030. Mudaram só as ORIGENS:
--
--   `agendamentos` + `estado = 'concluido'`   ->  `servicos_no_caixa`   (4x)
--   `(criado_em at time zone …)::date`        ->  `v.data_caixa`       (11x)
--   `venda_no_recorte(agendamento, ids)`      ->  + `v.barbeiro_id`     (5x)
--
-- Nenhuma expressão de soma, nenhum filtro e nenhuma regra de "o que está
-- marcado manda" foi tocada — a tabela da 0030 continua valendo inteira.

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
    from public.servicos_no_caixa a
    where a.data >= p_inicio
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
    where v.data_caixa >= p_inicio
      and v.data_caixa < p_fim
      and i.produto_id = any (p_produto_ids)
      and public.venda_no_recorte(v.agendamento_id, v.barbeiro_id, p_barbeiro_ids);
  else
    select coalesce(sum(v.total_centavos), 0), count(*)
    into v_loja_centavos, v_vendas
    from public.vendas_no_caixa v
    where v.data_caixa >= p_inicio
      and v.data_caixa < p_fim
      and public.venda_no_recorte(v.agendamento_id, v.barbeiro_id, p_barbeiro_ids);
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
      from public.servicos_no_caixa a
      join public.servicos s on s.id = a.servico_id
      where a.data >= p_inicio
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
    where v.data_caixa >= p_inicio
      and v.data_caixa < p_fim
      and not v_sem_loja
      and (not v_filtra_produto or i.produto_id = any (p_produto_ids))
      and public.venda_no_recorte(v.agendamento_id, v.barbeiro_id, p_barbeiro_ids)
    group by i.nome
  ) t;

  select least(
           (select min(a.data) from public.servicos_no_caixa a),
           (select min(v.data_caixa)
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
                   from public.servicos_no_caixa a
                   where a.data >= m.mes
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
                   where v.data_caixa >= m.mes
                     and v.data_caixa < (m.mes + interval '1 month')::date
                     and i.produto_id = any (p_produto_ids)
                     and public.venda_no_recorte(v.agendamento_id, v.barbeiro_id, p_barbeiro_ids)
                 )
                 else (
                   select coalesce(sum(v.total_centavos), 0)
                   from public.vendas_no_caixa v
                   where v.data_caixa >= m.mes
                     and v.data_caixa < (m.mes + interval '1 month')::date
                     and public.venda_no_recorte(v.agendamento_id, v.barbeiro_id, p_barbeiro_ids)
                 )
               end,
               'atendimentos', case
                 when v_sem_servicos then 0
                 else (
                   select count(*)
                   from public.servicos_no_caixa a
                   where a.data >= m.mes
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
  'Numeros do dashboard no intervalo [inicio, fim). Le servicos_no_caixa (atendimento concluido + contagem manual) e vendas_no_caixa. Um lado so some quando o outro foi marcado sozinho; marcar servico E produto traz os dois. Barbeiro filtra os dois lados.';

revoke all on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean) from public;
grant execute on function public.resumo_dashboard(date, date, uuid[], uuid[], uuid[], boolean)
  to authenticated;


-- ------------------------------------------------------------
-- 7. Ler o que já foi lançado naquele dia
-- ------------------------------------------------------------
--
-- O modal abre mostrando os números que já estão lá. Sem isto, quem
-- reabre vê tudo zerado, digita de novo o que já tinha digitado, e a
-- correção vira duplicata.
--
-- Devolve objeto id -> quantidade, e não lista: a tela procura pelo id de
-- cada linha do catálogo, e um objeto é uma consulta direta em vez de uma
-- varredura por item.

create or replace function public.registro_manual_do_dia(
  p_data date,
  p_barbeiro_id uuid
)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'servicos', coalesce((
      select jsonb_object_agg(r.servico_id::text, r.quantidade)
      from public.registros_servico_manual r
      where r.barbearia_id = auth.uid()
        and r.data = p_data
        and r.barbeiro_id = p_barbeiro_id
    ), '{}'::jsonb),
    'produtos', coalesce((
      select jsonb_object_agg(i.produto_id::text, i.quantidade)
      from public.itens_venda i
      join public.vendas v on v.id = i.venda_id
      where v.barbearia_id = auth.uid()
        and v.dia_manual = p_data
        -- `is not distinct from` e nao `=`: o balcao tem barbeiro nulo, e
        -- `null = null` devolve null, nao verdadeiro.
        and v.barbeiro_id is not distinct from p_barbeiro_id
    ), '{}'::jsonb)
  )
$$;

comment on function public.registro_manual_do_dia is
  'O que ja foi lancado a mao naquele dia para aquele barbeiro, como id -> quantidade.';

revoke all on function public.registro_manual_do_dia(date, uuid) from public;
grant execute on function public.registro_manual_do_dia(date, uuid) to authenticated;


-- ------------------------------------------------------------
-- 8. Gravar o dia
-- ------------------------------------------------------------
--
-- CORRIGE, não soma. O que chega é o dia inteiro daquele barbeiro: 5
-- cabelos quer dizer "foram 5", não "mais 5". É a mesma forma da
-- `ajustar_comanda` (0011) — compara com o que está lá e move o estoque
-- pela DIFERENÇA.
--
-- Por que não somar: o modal pergunta "quantos ele fez no dia". Quem
-- reabre para trocar 5 por 6 espera 6. Somando, teria 11, e o número
-- errado só apareceria no fechamento do mês.
--
-- TUDO OU NADA. Estoque insuficiente em QUALQUER produto aborta o bloco
-- inteiro e nada é gravado — inclusive os serviços, que são processados
-- antes. Meia gravação é pior que nenhuma: o dono não teria como saber
-- onde parou.

create or replace function public.registrar_dia_manual(
  p_data date,
  p_barbeiro_id uuid,
  p_servicos jsonb default '[]'::jsonb,
  p_produtos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_barbearia uuid := auth.uid();
  v_hoje      date;
  v_linha     jsonb;
  v_qtd       integer;
  v_servico   record;
  v_produto   record;
  v_venda_id  uuid;
  v_atual     integer;
  v_delta     integer;
  v_cortes    integer := 0;
  v_itens     integer := 0;
begin
  if v_barbearia is null then
    return jsonb_build_object('ok', false, 'erro', 'Entre de novo para registrar.');
  end if;

  v_hoje := (now() at time zone 'America/Sao_Paulo')::date;

  -- Dia que ainda não aconteceu não tem movimento para contar, e quase
  -- sempre é ano digitado errado no seletor de data.
  if p_data is null or p_data > v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um dia que já aconteceu.');
  end if;

  if p_data < v_hoje - 366 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para lançar até um ano atrás.');
  end if;

  if p_barbeiro_id is not null and not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_barbearia
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro não encontrado nesta barbearia.');
  end if;

  -- Corte sempre tem quem cortou. A venda, não: a geladeira do balcão é
  -- da loja, e entra como avulsa igual à do QR.
  if p_barbeiro_id is null
     and jsonb_array_length(coalesce(p_servicos, '[]'::jsonb)) > 0 then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Escolha o barbeiro para lançar serviços.'
    );
  end if;

  begin
    -- ---------- os serviços ----------
    for v_linha in
      select * from jsonb_array_elements(coalesce(p_servicos, '[]'::jsonb))
    loop
      v_qtd := coalesce((v_linha->>'quantidade')::integer, 0);

      if v_qtd < 0 or v_qtd > 999 then
        raise exception using errcode = 'BR001',
          message = 'Quantidade tem que ser de 0 a 999.';
      end if;

      select s.id, s.nome, s.preco_centavos into v_servico
      from public.servicos s
      where s.id = (v_linha->>'id')::uuid
        and s.barbearia_id = v_barbearia;

      if not found then
        raise exception using errcode = 'BR001',
          message = 'Serviço não encontrado nesta barbearia.';
      end if;

      if v_qtd = 0 then
        -- Zero apaga a linha em vez de guardar um zero: contagem zerada e
        -- contagem inexistente são a mesma coisa, e uma delas suja a view.
        delete from public.registros_servico_manual r
        where r.barbearia_id = v_barbearia
          and r.data = p_data
          and r.barbeiro_id = p_barbeiro_id
          and r.servico_id = v_servico.id;
      else
        insert into public.registros_servico_manual
          (barbearia_id, data, barbeiro_id, servico_id, quantidade, preco_centavos)
        values
          (v_barbearia, p_data, p_barbeiro_id, v_servico.id, v_qtd,
           v_servico.preco_centavos)
        on conflict (barbearia_id, data, barbeiro_id, servico_id) do update
          set quantidade = excluded.quantidade,
              -- Corrigir o dia REPREÇA o dia pela tabela de hoje. É o
              -- preço do serviço agora, e corrigir é relançar.
              preco_centavos = excluded.preco_centavos,
              atualizado_em = now();

        v_cortes := v_cortes + v_qtd;
      end if;
    end loop;

    -- ---------- a loja ----------
    if jsonb_array_length(coalesce(p_produtos, '[]'::jsonb)) > 0 then

      select v.id into v_venda_id
      from public.vendas v
      where v.barbearia_id = v_barbearia
        and v.dia_manual = p_data
        and v.barbeiro_id is not distinct from p_barbeiro_id
      for update;

      if not found then
        insert into public.vendas
          (barbearia_id, total_centavos, dia_manual, barbeiro_id)
        values (v_barbearia, 0, p_data, p_barbeiro_id)
        returning id into v_venda_id;
      end if;

      for v_linha in select * from jsonb_array_elements(p_produtos)
      loop
        v_qtd := coalesce((v_linha->>'quantidade')::integer, 0);

        if v_qtd < 0 or v_qtd > 999 then
          raise exception using errcode = 'BR001',
            message = 'Quantidade tem que ser de 0 a 999.';
        end if;

        -- `for update` segura a linha do estoque até o fim da transação:
        -- sem isso, o QR da loja vendendo o mesmo produto no mesmo
        -- instante faria as duas baixas lerem o mesmo saldo.
        select p.id, p.nome, p.preco_centavos, p.unidades into v_produto
        from public.produtos p
        where p.id = (v_linha->>'id')::uuid
          and p.barbearia_id = v_barbearia
        for update;

        if not found then
          raise exception using errcode = 'BR001',
            message = 'Produto não encontrado nesta barbearia.';
        end if;

        select i.quantidade into v_atual
        from public.itens_venda i
        where i.venda_id = v_venda_id
          and i.produto_id = v_produto.id;

        if not found then
          v_atual := 0;
        end if;

        -- Positivo sai da prateleira; negativo volta para ela.
        v_delta := v_qtd - v_atual;

        if v_delta <> 0 then
          update public.produtos
          set unidades = unidades - v_delta
          where id = v_produto.id
            and barbearia_id = v_barbearia
            and unidades - v_delta >= 0;

          if not found then
            raise exception using errcode = 'BR001',
              message = v_produto.nome || ': você lançou ' || v_qtd
                || ' e só há ' || (v_produto.unidades + v_atual)
                || ' em estoque. Dê entrada no estoque antes.';
          end if;
        end if;

        if v_qtd = 0 then
          delete from public.itens_venda
          where venda_id = v_venda_id and produto_id = v_produto.id;
        elsif v_atual = 0 then
          insert into public.itens_venda
            (venda_id, produto_id, nome, preco_centavos, quantidade)
          values
            (v_venda_id, v_produto.id, v_produto.nome,
             v_produto.preco_centavos, v_qtd);
        else
          update public.itens_venda
          set quantidade = v_qtd,
              nome = v_produto.nome,
              preco_centavos = v_produto.preco_centavos
          where venda_id = v_venda_id and produto_id = v_produto.id;
        end if;

        v_itens := v_itens + v_qtd;
      end loop;

      -- Total derivado dos itens, igual à 0011: somar à mão em dois
      -- lugares é como a diferença aparece no caixa.
      update public.vendas v
      set total_centavos = coalesce(
        (select sum(i.preco_centavos * i.quantidade)
           from public.itens_venda i
          where i.venda_id = v.id),
        0
      )
      where v.id = v_venda_id;

      -- Zerou tudo: a venda sai. R$ 0,00 pendurado vira linha fantasma.
      delete from public.vendas v
      where v.id = v_venda_id
        and not exists (
          select 1 from public.itens_venda i where i.venda_id = v.id
        );
    end if;

  exception
    when sqlstate 'BR001' then
      -- Só erro de regra vira resposta. Falha de verdade sobe e aborta
      -- tudo, que é o que deve acontecer.
      return jsonb_build_object('ok', false, 'erro', sqlerrm);
  end;

  return jsonb_build_object('ok', true, 'cortes', v_cortes, 'itens', v_itens);
end $$;

comment on function public.registrar_dia_manual is
  'Lanca a contagem do dia de um barbeiro: corrige o que ja estava la e move o estoque pela diferenca. Tudo ou nada.';

revoke all on function public.registrar_dia_manual(date, uuid, jsonb, jsonb) from public;
grant execute on function public.registrar_dia_manual(date, uuid, jsonb, jsonb)
  to authenticated;

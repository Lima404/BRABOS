-- ============================================================
-- BARBOS — migração 0006: horário não pode pisar em outro
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002 (agendamentos) e 0003 (serviços). Pode rodar mais de uma vez.
--
-- REGRA: uma cadeira, um cliente por vez. Um corte das 9h às 10h bloqueia
-- 9h30, 9h45 e qualquer outro começo dentro desse intervalo.
--
-- A restrição de 0002 (`unique (barbearia_id, data, horario)`) só pegava o
-- MESMO minuto — 9h30 passava direto por cima de um corte de uma hora. Além
-- disso ela não perdoava cancelamento: cancelar as 9h e remarcar as 9h dava
-- erro, ao contrário do que o comentário dela prometia.
-- ============================================================

-- Precisa disto para misturar `uuid with =` e `tsrange with &&` no mesmo
-- índice GiST. Vem disponível no Supabase.
create extension if not exists btree_gist;

-- ============================================================
-- 1. A duração vira dado do agendamento
--
-- Hoje a duração vem de `servicos.duracao_min`. Isso não serve de base para
-- a regra: mudar "Cabelo" de 30 para 60 minutos faria TODO agendamento
-- passado esticar, inventando conflitos que nunca existiram — e mexendo no
-- histórico. Mesma razão de `preco_centavos` ser copiado no ato.
-- ============================================================

alter table public.agendamentos
  add column if not exists duracao_min smallint
    check (duracao_min between 5 and 480);

update public.agendamentos a
set duracao_min = s.duracao_min
from public.servicos s
where s.id = a.servico_id
  and a.duracao_min is null;

do $$
begin
  if exists (select 1 from public.agendamentos where duracao_min is null) then
    raise warning
      'BARBOS: há agendamentos sem duração. Corrija e rode de novo para o NOT NULL.';
  else
    alter table public.agendamentos alter column duracao_min set not null;
  end if;
end $$;

comment on column public.agendamentos.duracao_min is
  'Duração COPIADA do serviço no ato. Reajuste de duração não move horário já marcado.';

-- ============================================================
-- 2. O intervalo ocupado, calculado pelo banco
--
-- Coluna gerada: não dá pra ficar errada, porque ninguém escreve nela.
-- `[)` — começo incluído, fim excluído: das 9h às 10h e das 10h às 11h NÃO
-- se sobrepõem. Sem isso, todo horário emendado seria recusado.
-- ============================================================

alter table public.agendamentos
  add column if not exists periodo tsrange
    generated always as (
      tsrange(
        (data + horario)::timestamp,
        (data + horario)::timestamp + make_interval(mins => duracao_min),
        '[)'
      )
    ) stored;

comment on column public.agendamentos.periodo is
  'Intervalo ocupado na cadeira. Gerado de data+horario+duracao_min.';

-- ============================================================
-- 3. A trava
--
-- Cancelado fica de fora: o horário volta a ficar livre. "Não compareceu"
-- NÃO fica — o cliente furou, mas a cadeira ficou ocupada esperando, e o
-- histórico tem que continuar mostrando isso.
--
-- Se já houver sobreposição no banco, a restrição não pode ser criada. Em vez
-- de abortar a migração inteira, avisamos quais são e deixamos o resto no
-- lugar — a dona corrige e roda de novo.
-- ============================================================

do $$
declare
  conflitos integer;
  amostra text;
begin
  select count(*), string_agg(texto, e'\n  ')
  into conflitos, amostra
  from (
    select format(
             '%s %s (%s) sobrepõe %s (%s)',
             a.data, a.horario, a.cliente_nome, b.horario, b.cliente_nome
           ) as texto
    from public.agendamentos a
    join public.agendamentos b
      on b.barbearia_id = a.barbearia_id
     and b.id > a.id
     and b.periodo && a.periodo
    where a.estado <> 'cancelado'
      and b.estado <> 'cancelado'
    limit 5
  ) as amostras;

  if coalesce(conflitos, 0) > 0 then
    raise warning
      'BARBOS: já existem horários sobrepostos. A trava NÃO foi criada. Corrija estes e rode de novo:%s  %s',
      e'\n', amostra;
    return;
  end if;

  alter table public.agendamentos
    drop constraint if exists agendamento_sem_sobreposicao;

  alter table public.agendamentos
    add constraint agendamento_sem_sobreposicao
    exclude using gist (
      barbearia_id with =,
      periodo with &&
    ) where (estado <> 'cancelado');

  -- Só agora: a antiga era a única proteção até este ponto. E ela precisa
  -- sair — sem `where`, ela recusava remarcar um horário cancelado.
  alter table public.agendamentos
    drop constraint if exists agendamento_sem_choque;

  raise notice 'BARBOS: trava de sobreposição criada.';
end $$;

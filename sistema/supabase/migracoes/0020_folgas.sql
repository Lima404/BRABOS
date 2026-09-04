-- ============================================================
-- BARBOS — migração 0020: folgas (dias avulsos sem atendimento)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0018 e 0019. Pode rodar mais de uma vez.
--
-- "Dias de atendimento" é a SEMANA — vale para todas as segundas.
-- Folga é a EXCEÇÃO de um dia só: feriado, viagem, casamento.
-- São coisas diferentes e por isso moram em lugares diferentes;
-- desmarcar segunda pra fechar num feriado fecharia o mês inteiro.
--
-- Folga NÃO cancela quem já marcou. Ela fecha o dia para agendamento
-- NOVO; quem já está na agenda continua lá, e avisar é da dona.
-- Apagar agendamento por tabela seria decidir no lugar dela.
--
-- O banco de teste JÁ TINHA uma tabela `folgas` quando este arquivo
-- foi escrito. Por isso o `create table if not exists` não basta: ele
-- não repara uma tabela que já existe sem a restrição de unicidade ou
-- sem RLS. Os blocos DO abaixo acrescentam o que faltar, e não
-- fazem nada quando já está tudo lá.
-- ============================================================

create table if not exists public.folgas (
  id            uuid primary key default gen_random_uuid(),

  barbearia_id  uuid not null default auth.uid()
                  references public.barbearias(id) on delete cascade,

  data          date not null,

  criado_em     timestamptz not null default now(),

  -- Marcar o mesmo dia duas vezes é a mesma folga, não duas.
  constraint folga_unica_no_dia unique (barbearia_id, data)
);

comment on table public.folgas is
  'Dias avulsos em que a barbearia não abre. A semana fica em configuracao_agenda.';

-- Reparos para uma `folgas` criada antes desta migração.
do $$
begin
  -- Sem isto, marcar o mesmo dia duas vezes cria DUAS folgas, e o
  -- código que trata 23505 como "já era folga" nunca é acionado.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.folgas'::regclass
      and conname = 'folga_unica_no_dia'
  ) then
    alter table public.folgas
      add constraint folga_unica_no_dia unique (barbearia_id, data);
  end if;

  -- Sem a chave estrangeira, apagar a barbearia deixaria folga órfã.
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.folgas'::regclass
      and contype = 'f'
      and conname = 'folgas_barbearia_id_fkey'
  ) then
    alter table public.folgas
      add constraint folgas_barbearia_id_fkey
      foreign key (barbearia_id) references public.barbearias(id)
      on delete cascade;
  end if;
end $$;

create index if not exists folgas_barbearia_data_idx
  on public.folgas (barbearia_id, data);

alter table public.folgas enable row level security;

drop policy if exists "folgas da propria barbearia" on public.folgas;
create policy "folgas da propria barbearia" on public.folgas
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ------------------------------------------------------------
-- agenda_publica — o dia pedido é folga?
--
-- Só um booleano do dia consultado. Devolver a lista de folgas do mês
-- seria contar pra fora quando a barbearia está vazia, e quem abre o
-- link não tem nada que fazer com isso.
-- ------------------------------------------------------------

create or replace function public.agenda_publica(
  p_slug text,
  p_data date
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_id    uuid;
  v_nome  text;
  v_cfg   record;
  v_folga boolean;
begin
  select b.id, b.nome into v_id, v_nome
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  select exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) into v_folga;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),
    'folga', v_folga,

    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00'),
      'porTurno', coalesce(v_cfg.por_turno, false),
      'manha', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.manha_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.manha_fecha, 'HH24:MI')
               ) else null end,
      'tarde', case when v_cfg.por_turno then jsonb_build_object(
                 'abre', to_char(v_cfg.tarde_abre, 'HH24:MI'),
                 'fecha', to_char(v_cfg.tarde_fecha, 'HH24:MI')
               ) else null end
    ),

    'servicos', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id,
               'nome', s.nome,
               'cor', s.cor,
               'duracaoMin', s.duracao_min,
               'precoCentavos', s.preco_centavos,
               'ativo', true,
               'ordem', s.ordem
             ) order by s.ordem, s.nome)
      from public.servicos s
      where s.barbearia_id = v_id and s.ativo
    ), '[]'::jsonb),

    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome)
             order by b.nome)
      from public.barbeiros b
      where b.barbearia_id = v_id and b.ativo
    ), '[]'::jsonb),

    'ocupados', coalesce((
      select jsonb_agg(jsonb_build_object(
               'barbeiroId', a.barbeiro_id,
               'horario', to_char(a.horario, 'HH24:MI'),
               'duracaoMin', a.duracao_min
             ) order by a.horario)
      from public.agendamentos a
      where a.barbearia_id = v_id
        and a.data = p_data
        and a.estado <> 'cancelado'
        and a.barbeiro_id is not null
    ), '[]'::jsonb)
  );
end $$;

-- ------------------------------------------------------------
-- criar_agendamento_publico — recusa folga
--
-- A checagem vem ANTES da do dia da semana: numa segunda de feriado as
-- duas valem, e "não abre nesse dia" é a resposta certa das duas.
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico(
  p_slug text,
  p_cliente_nome text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_horario time,
  p_observacao text default null
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_id      uuid;
  v_hoje    date := (now() at time zone 'America/Sao_Paulo')::date;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_fim     time;
  v_ok      boolean := false;
  v_rotulo  text;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  v_nome := btrim(coalesce(p_cliente_nome, ''));
  if length(v_nome) < 2 or length(v_nome) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  select s.id, s.duracao_min, s.preco_centavos into v_servico
  from public.servicos s
  where s.id = p_servico_id and s.barbearia_id = v_id and s.ativo;

  if v_servico.id is null then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível. Escolha outro.');
  end if;

  if not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_id and b.ativo
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro indisponível. Escolha outro.');
  end if;

  if p_data < v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Essa data já passou.');
  end if;
  if p_data > v_hoje + 90 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para marcar com até 90 dias de antecedência.');
  end if;

  if exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não abre nesse dia. Escolha outra data.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);

  if not (extract(dow from p_data)::smallint = any (v_dias)) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não atende nesse dia.');
  end if;

  v_fim := p_horario + make_interval(mins => v_servico.duracao_min);

  if coalesce(v_cfg.por_turno, false) then
    if p_horario >= v_cfg.manha_abre and v_fim <= v_cfg.manha_fecha then
      v_ok := true;
    elsif p_horario >= v_cfg.tarde_abre and v_fim <= v_cfg.tarde_fecha then
      v_ok := true;
    end if;
    v_rotulo :=
      to_char(v_cfg.manha_abre, 'HH24:MI') || '–' || to_char(v_cfg.manha_fecha, 'HH24:MI') ||
      ', ' ||
      to_char(v_cfg.tarde_abre, 'HH24:MI') || '–' || to_char(v_cfg.tarde_fecha, 'HH24:MI');
  else
    v_ok := p_horario >= coalesce(v_cfg.abre, '09:00'::time)
        and v_fim <= coalesce(v_cfg.fecha, '19:00'::time);
    v_rotulo :=
      to_char(coalesce(v_cfg.abre, '09:00'::time), 'HH24:MI') || ' às ' ||
      to_char(coalesce(v_cfg.fecha, '19:00'::time), 'HH24:MI');
  end if;

  if not v_ok then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Fora do horário de atendimento (' || v_rotulo || ').'
    );
  end if;

  if extract(minute from p_horario)::int % 5 <> 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um horário fechado (de 5 em 5 minutos).');
  end if;

  begin
    insert into public.agendamentos (
      barbearia_id, barbeiro_id, cliente_nome, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_nome, v_servico.id,
      p_data, p_horario, 'agendado',
      v_servico.preco_centavos, v_servico.duracao_min,
      nullif(btrim(coalesce(p_observacao, '')), '')
    );
  exception
    when exclusion_violation then
      return jsonb_build_object(
        'ok', false,
        'erro', 'Esse horário acabou de ser ocupado. Escolha outro.'
      );
    when check_violation then
      return jsonb_build_object('ok', false, 'erro', 'Dados inválidos para este agendamento.');
  end;

  return jsonb_build_object(
    'ok', true,
    'horario', to_char(p_horario, 'HH24:MI'),
    'data', p_data
  );
end $$;

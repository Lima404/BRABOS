-- ============================================================
-- BARBOS — migração 0019: horário de atendimento por turno
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0003 e 0018. Pode rodar mais de uma vez.
--
-- `por_turno = false` → um intervalo contínuo (abre/fecha), como sempre.
-- `por_turno = true`  → manhã e tarde; abre/fecha viram o envelope
--                       do dia (abre da manhã → fecha da tarde).
-- ============================================================

alter table public.configuracao_agenda
  add column if not exists por_turno boolean not null default false,
  add column if not exists manha_abre  time,
  add column if not exists manha_fecha time,
  add column if not exists tarde_abre  time,
  add column if not exists tarde_fecha time;

-- Se uma versão anterior desta migração criou o turno da noite, some.
alter table public.configuracao_agenda
  drop column if exists noite_abre,
  drop column if exists noite_fecha;

alter table public.configuracao_agenda
  drop constraint if exists horario_de_atendimento_valido;

alter table public.configuracao_agenda
  drop constraint if exists horario_de_atendimento_por_turno;

alter table public.configuracao_agenda
  add constraint horario_de_atendimento_por_turno check (
    (
      por_turno = false
      and fecha > abre
    )
    or (
      por_turno = true
      and manha_abre is not null and manha_fecha is not null
      and tarde_abre is not null and tarde_fecha is not null
      and manha_fecha > manha_abre
      and tarde_fecha > tarde_abre
      and manha_fecha <= tarde_abre
      and abre = manha_abre
      and fecha = tarde_fecha
    )
  );

comment on column public.configuracao_agenda.por_turno is
  'Se true, o expediente é manhã/tarde; se false, um único abre/fecha.';

-- ------------------------------------------------------------
-- agenda_publica — devolve também os turnos
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
  v_id   uuid;
  v_nome text;
  v_cfg  record;
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

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),

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
-- criar_agendamento_publico — cabe em ALGUM turno (ou no intervalo único)
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

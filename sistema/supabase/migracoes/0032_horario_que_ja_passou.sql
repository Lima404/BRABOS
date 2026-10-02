-- ============================================================
-- BARBOS — migração 0032: o link público recusa horário que já passou
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0031. Pode rodar mais de uma vez.
--
-- Havia a recusa de DIA passado (`p_data < v_hoje`) e nenhuma de HORA:
-- às 18h, quem abrisse o link conseguia marcar as 09:00 de hoje. A tela
-- já não oferece esses horários, mas tela não é barreira — esta função
-- é um endereço HTTP público, e quem chega por fora dela não passa por
-- nenhum seletor.
--
-- O relógio é o da barbearia (America/Sao_Paulo), o mesmo de `v_hoje`
-- logo acima: o servidor roda em UTC, e às 21h de São Paulo o UTC já
-- virou o dia seguinte.
--
-- Vale só para o link público. Na agenda interna, lançar um atendimento
-- que acabou de acontecer é rotina — o barbeiro esqueceu de registrar o
-- cliente das 14h e lança às 15h. Lá a recusa é da TELA, ao marcar
-- horário novo, e não do banco.
-- ============================================================

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
  v_agora   timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje    date := v_agora::date;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_fim     time;
  v_ok      boolean := false;
  v_rotulo  text;
  v_passo   smallint;
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

  -- Hoje, o relógio também conta. Antes só o calendário contava, e às 18h
  -- dava para marcar as 09:00 de hoje por fora da tela.
  if p_data = v_hoje and p_horario < v_agora::time then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Esse horário já passou — agora são ' ||
              to_char(v_agora, 'HH24:MI') ||
              '. Escolha um mais tarde, ou outro dia.'
    );
  end if;

  if exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não abre nesse dia. Escolha outra data.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha, c.passo_min
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias  := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);
  v_passo := coalesce(v_cfg.passo_min, 15);

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

  -- A grade segue o relógio: com passo 30, vale 09:00 e 09:30 e mais nada.
  if (extract(hour from p_horario)::int * 60
      + extract(minute from p_horario)::int) % v_passo <> 0 then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Esta barbearia marca de ' ||
              case when v_passo = 60 then 'hora em hora'
                   else v_passo::text || ' em ' || v_passo::text || ' minutos' end ||
              '. Escolha um horário da grade.'
    );
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

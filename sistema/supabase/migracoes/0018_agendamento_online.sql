-- ============================================================
-- BARBOS — migração 0018: agendamento online (link público)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0002, 0003, 0005, 0006, 0014 e 0015. Pode rodar mais de uma vez.
--
-- Duas funções, ambas para quem NÃO tem conta — o cliente que recebeu o link:
--   1. `agenda_publica`      — o que a tela precisa para desenhar o dia
--   2. `criar_agendamento_publico` — a marcação em si
--
-- PRIVACIDADE — a régua aqui é mais apertada que a da loja:
-- a tela pública precisa mostrar o que está OCUPADO, e nada além disso. Vão
-- horário e duração; NÃO vai nome de cliente, nem observação, nem telefone de
-- barbeiro. Quem quer marcar às 10h só precisa saber que as 10h estão presas —
-- de quem elas são não é da conta dele.
-- ============================================================

-- ------------------------------------------------------------
-- 1. O que a tela pública lê
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

  select c.dias_atendimento, c.abre, c.fecha
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object('id', v_id, 'nome', v_nome, 'slug', p_slug),

    -- Sem linha de configuração, o padrão do app: seg-sáb, 9h às 19h.
    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00')
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

    -- Telefone do barbeiro NÃO sai: é dado da equipe, não do atendimento.
    'barbeiros', coalesce((
      select jsonb_agg(jsonb_build_object('id', b.id, 'nome', b.nome)
             order by b.nome)
      from public.barbeiros b
      where b.barbearia_id = v_id and b.ativo
    ), '[]'::jsonb),

    -- Só o retângulo ocupado. Ver o bloco PRIVACIDADE no topo.
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

comment on function public.agenda_publica is
  'Dados da tela pública de agendamento. Sem nome de cliente e sem telefone de barbeiro.';

revoke all on function public.agenda_publica(text, date) from public;
grant execute on function public.agenda_publica(text, date) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. A marcação feita pelo cliente
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
set search_path = public
as $$
declare
  v_fuso    text := 'America/Sao_Paulo';
  v_hoje    date := (now() at time zone v_fuso)::date;
  v_id      uuid;
  v_nome    text;
  v_servico record;
  v_cfg     record;
  v_dias    smallint[];
  v_abre    time;
  v_fecha   time;
  v_fim     time;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  -- ---- nome ----
  v_nome := btrim(coalesce(p_cliente_nome, ''));
  if length(v_nome) < 2 or length(v_nome) > 60 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  -- ---- serviço ----
  select s.id, s.duracao_min, s.preco_centavos
  into v_servico
  from public.servicos s
  where s.id = p_servico_id and s.barbearia_id = v_id and s.ativo;

  if not found then
    return jsonb_build_object('ok', false, 'erro', 'Serviço indisponível. Escolha outro.');
  end if;

  -- ---- barbeiro ----
  if not exists (
    select 1 from public.barbeiros b
    where b.id = p_barbeiro_id and b.barbearia_id = v_id and b.ativo
  ) then
    return jsonb_build_object('ok', false, 'erro', 'Barbeiro indisponível. Escolha outro.');
  end if;

  -- ---- janela de datas ----
  -- Passado não se marca, e 90 dias é o teto: sem isso, um endereço público
  -- aceitaria encher a agenda de 2030 inteira em um laço.
  if p_data < v_hoje then
    return jsonb_build_object('ok', false, 'erro', 'Essa data já passou.');
  end if;
  if p_data > v_hoje + 90 then
    return jsonb_build_object('ok', false, 'erro', 'Só dá para marcar com até 90 dias de antecedência.');
  end if;

  -- ---- expediente ----
  select c.dias_atendimento, c.abre, c.fecha into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  v_dias  := coalesce(v_cfg.dias_atendimento, array[1,2,3,4,5,6]::smallint[]);
  v_abre  := coalesce(v_cfg.abre,  '09:00'::time);
  v_fecha := coalesce(v_cfg.fecha, '19:00'::time);

  if not (extract(dow from p_data)::smallint = any (v_dias)) then
    return jsonb_build_object('ok', false, 'erro', 'A barbearia não atende nesse dia.');
  end if;

  v_fim := p_horario + make_interval(mins => v_servico.duracao_min);

  if p_horario < v_abre or v_fim > v_fecha then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Fora do horário de atendimento (' ||
              to_char(v_abre, 'HH24:MI') || ' às ' || to_char(v_fecha, 'HH24:MI') || ').'
    );
  end if;

  if extract(minute from p_horario)::int % 5 <> 0 then
    return jsonb_build_object('ok', false, 'erro', 'Escolha um horário fechado (de 5 em 5 minutos).');
  end if;

  -- ---- grava ----
  -- Preço e duração congelados aqui, como em toda marcação: reajuste depois
  -- não reescreve o que foi combinado.
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
    -- A trava `agendamento_sem_sobreposicao` é quem decide de verdade: entre
    -- a tela desenhar o dia e o cliente tocar em confirmar, outra pessoa pode
    -- ter pegado o mesmo horário.
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

comment on function public.criar_agendamento_publico is
  'Marcação feita pelo cliente, sem conta. Valida slug, serviço, barbeiro, janela de datas e expediente.';

revoke all on function public.criar_agendamento_publico(text, text, uuid, uuid, date, time, text) from public;
grant execute on function public.criar_agendamento_publico(text, text, uuid, uuid, date, time, text)
  to anon, authenticated;

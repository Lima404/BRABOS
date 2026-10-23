-- ============================================================
-- BARBOS — migração 0037: telefone do cliente no agendamento
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0032 e 0035. Pode rodar mais de uma vez.
--
-- Quem marca passa a deixar o número. Sem ele a barbearia não tem como
-- avisar atraso, confirmar véspera nem falar com quem não apareceu — e
-- era a última coisa que faltava para a conversa do WhatsApp começar
-- pelos dois lados.
--
-- ============================================================
-- A COLUNA ACEITA NULL, E O CAMPO É OBRIGATÓRIO. NÃO É CONTRADIÇÃO.
-- ============================================================
--
-- Já existem agendamentos gravados sem telefone — ninguém podia informar.
-- `not null` recusaria a própria migração, e inventar número para as
-- linhas antigas seria gravar mentira no banco.
--
-- Então o obrigatório vale para o que entra AGORA, e mora em dois
-- lugares: o formulário (conveniência de quem digita) e a ação de
-- servidor (barreira, porque ação de servidor é endereço HTTP público
-- como qualquer outro).
--
-- Aqui o banco cobra o FORMATO: ou é null, ou tem 10 ou 11 dígitos. Um
-- "(84) 9" meio digitado não entra nem por fora da tela.
--
-- ============================================================
-- POR QUE A RPC AINDA ACEITA CHEGAR SEM TELEFONE
-- ============================================================
--
-- Este banco é o MESMO da produção. Enquanto o deploy desta branch não
-- acontece, a produção continua chamando estas funções sem o argumento
-- novo — e exigir o telefone aqui derrubaria o agendamento online de
-- verdade, hoje, por causa de uma tela que ainda não está no ar.
--
-- Depois do deploy, exigir no banco também é trocar o `if` marcado
-- "DEPOIS DO DEPLOY" lá embaixo. Até lá a recusa é da ação de servidor,
-- que a tela nova sempre atravessa.
-- ============================================================

-- ------------------------------------------------------------
-- A coluna
-- ------------------------------------------------------------

alter table public.agendamentos
  add column if not exists cliente_telefone text;

comment on column public.agendamentos.cliente_telefone is
  'Telefone de quem marcou, com DDD e com mascara. Null em linha anterior a 0037.';

-- `add constraint if not exists` não existe no Postgres — daí o bloco.
do $$
begin
  alter table public.agendamentos
    add constraint agendamento_telefone_com_ddd
    check (
      cliente_telefone is null
      or length(regexp_replace(cliente_telefone, '[^0-9]', '', 'g')) between 10 and 11
    );
exception
  when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- criar_agendamento_publico — agora com o telefone
--
-- A assinatura MUDOU (um argumento a mais). O `drop` antes do `create` é
-- obrigatório: `create or replace` com assinatura diferente deixaria as
-- duas versões no banco, e aí uma chamada com os 7 argumentos de sempre
-- viraria "function is not unique" — o agendamento online pararia por
-- ambiguidade. Como o arquivo roda numa transação só, não existe o
-- instante em que a função não existe.
-- ------------------------------------------------------------

drop function if exists public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text);
drop function if exists public.criar_agendamento_publico(
  text, text, uuid, uuid, date, time, text);

create or replace function public.criar_agendamento_publico(
  p_slug text,
  p_cliente_nome text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_horario time,
  p_observacao text default null,
  p_cliente_telefone text default null
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
  v_tel     text;
  v_digitos text;
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

  -- ---- telefone (novo na 0037) ----
  v_tel     := nullif(btrim(coalesce(p_cliente_telefone, '')), '');
  v_digitos := regexp_replace(coalesce(v_tel, ''), '[^0-9]', '', 'g');

  -- DEPOIS DO DEPLOY: trocar a primeira condição por `v_tel is null or`
  -- e o telefone passa a ser obrigatório aqui também. O cabeçalho deste
  -- arquivo conta por que ainda não é.
  if v_tel is not null and length(v_digitos) not between 10 and 11 then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Informe seu telefone com DDD (10 ou 11 dígitos).'
    );
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

  -- Hoje, o relógio também conta (0032).
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
      to_char(v_cfg.manha_abre, 'HH24:MI') || '-' || to_char(v_cfg.manha_fecha, 'HH24:MI') ||
      ', ' ||
      to_char(v_cfg.tarde_abre, 'HH24:MI') || '-' || to_char(v_cfg.tarde_fecha, 'HH24:MI');
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
      barbearia_id, barbeiro_id, cliente_nome, cliente_telefone, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_nome, v_tel, v_servico.id,
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

comment on function public.criar_agendamento_publico is
  'Marca pelo apelido da barbearia. Guarda o telefone de quem marcou desde a 0037.';

revoke all on function public.criar_agendamento_publico(
  text, text, uuid, uuid, date, time, text, text) from public;
grant execute on function public.criar_agendamento_publico(
  text, text, uuid, uuid, date, time, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- criar_agendamento_publico_por_chave — repassa o telefone
--
-- Mesmo corpo da 0035. O que muda é o argumento novo, que atravessa
-- até a função acima.
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico_por_chave(
  p_chave text,
  p_cliente_nome text,
  p_barbeiro_id uuid,
  p_servico_id uuid,
  p_data date,
  p_horario time,
  p_observacao text default null,
  p_cliente_telefone text default null
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_slug text;
  v_c    record;
  v_r    jsonb;
  v_id   uuid;
  -- Em plpgsql, ler campo de RECORD não atribuído ESTOURA. Pelo caminho
  -- do apelido o convite nunca é lido, então quem responde "veio de
  -- convite?" lá embaixo é esta variável, não `v_c.id`.
  v_convite_id uuid;
  v_usos       integer;
  v_usos_max   smallint;
begin
  select b.slug into v_slug
  from public.barbearias b
  where b.slug = p_chave
  limit 1;

  if v_slug is null then
    select c.id, c.codigo, c.expira_em, c.usos, c.usos_max, c.revogado,
           b.slug as slug
    into v_c
    from public.convites_agendamento c
    join public.barbearias b on b.id = c.barbearia_id
    where c.codigo = p_chave
    for update of c;

    if v_c.id is null then
      return jsonb_build_object('ok', false, 'erro', 'Esse link não existe.');
    end if;

    if v_c.revogado then
      return jsonb_build_object('ok', false,
        'erro', 'A barbearia desativou esse link. Peça o link novo a ela.');
    end if;

    if v_c.expira_em is not null and now() >= v_c.expira_em then
      return jsonb_build_object('ok', false,
        'erro', 'Esse link expirou. Peça o link novo à barbearia.');
    end if;

    if v_c.usos_max is not null and v_c.usos >= v_c.usos_max then
      return jsonb_build_object('ok', false,
        'erro', 'Esse link já atingiu o limite de agendamentos.');
    end if;

    v_slug       := v_c.slug;
    v_convite_id := v_c.id;
    v_usos       := v_c.usos;
    v_usos_max   := v_c.usos_max;
  end if;

  v_r := public.criar_agendamento_publico(
    v_slug, p_cliente_nome, p_barbeiro_id, p_servico_id,
    p_data, p_horario, p_observacao, p_cliente_telefone);

  if not coalesce((v_r->>'ok')::boolean, false) then
    return v_r;
  end if;

  -- O id do que acabou de entrar, pela chave natural do agendamento.
  select a.id into v_id
  from public.agendamentos a
  join public.barbearias b on b.id = a.barbearia_id
  where b.slug = v_slug
    and a.data = p_data
    and a.horario = p_horario
    and a.barbeiro_id = p_barbeiro_id
  order by a.criado_em desc
  limit 1;

  v_r := v_r || jsonb_build_object('agendamentoId', v_id);

  if v_convite_id is not null then
    update public.convites_agendamento
       set usos = usos + 1
     where id = v_convite_id;

    v_r := v_r || jsonb_build_object(
      'usos', v_usos + 1, 'usosMax', v_usos_max);
  end if;

  return v_r;
end $$;

comment on function public.criar_agendamento_publico_por_chave is
  'Marca pelo link publico, por apelido ou convite. Devolve o id para o aviso.';

revoke all on function public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text, text) from public;
grant execute on function public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text, text) to anon, authenticated;

-- ------------------------------------------------------------
-- avisar_agendamento — o telefone vai junto no aviso do celular
--
-- O resto do corpo é o mesmo da 0035. Quem recebe o aviso no bolso
-- quer poder ligar sem precisar abrir o sistema.
-- ------------------------------------------------------------

create or replace function public.avisar_agendamento(
  p_agendamento_id uuid
)
returns jsonb
language plpgsql
security definer
volatile
set search_path = public
as $$
declare
  v_a record;
begin
  -- `for update` porque logo abaixo carimbamos: duas chamadas no mesmo
  -- instante serializam aqui, e só a primeira leva os aparelhos.
  select a.id, a.barbearia_id, a.cliente_nome, a.cliente_telefone,
         a.data, a.horario, a.avisado_em, a.criado_em,
         s.nome as servico, b.nome as barbeiro, ba.nome as barbearia
  into v_a
  from public.agendamentos a
  join public.servicos s   on s.id = a.servico_id
  join public.barbearias ba on ba.id = a.barbearia_id
  left join public.barbeiros b on b.id = a.barbeiro_id
  where a.id = p_agendamento_id
  for update of a;

  if v_a.id is null then
    return jsonb_build_object('ok', false, 'motivo', 'nao-encontrado');
  end if;

  -- Tiro único.
  if v_a.avisado_em is not null then
    return jsonb_build_object('ok', false, 'motivo', 'ja-avisado');
  end if;

  -- Só vale para o que ACABOU de ser marcado.
  if now() - v_a.criado_em > interval '2 minutes' then
    return jsonb_build_object('ok', false, 'motivo', 'tarde-demais');
  end if;

  update public.agendamentos set avisado_em = now() where id = v_a.id;

  return jsonb_build_object(
    'ok', true,
    'agendamento', jsonb_build_object(
      'clienteNome',     v_a.cliente_nome,
      'clienteTelefone', coalesce(v_a.cliente_telefone, ''),
      'data',            to_char(v_a.data, 'YYYY-MM-DD'),
      'horario',         to_char(v_a.horario, 'HH24:MI'),
      'servico',         v_a.servico,
      'barbeiro',        coalesce(v_a.barbeiro, ''),
      'barbearia',       v_a.barbearia
    ),
    'assinaturas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'endpoint', ap.endpoint,
               'p256dh',   ap.p256dh,
               'auth',     ap.auth))
      from public.assinaturas_push ap
      where ap.barbearia_id = v_a.barbearia_id
    ), '[]'::jsonb)
  );
end $$;

comment on function public.avisar_agendamento is
  'Recado e aparelhos para avisar um agendamento recem-criado. Tiro unico, 2 minutos.';

revoke all on function public.avisar_agendamento(uuid) from public;
grant execute on function public.avisar_agendamento(uuid) to anon, authenticated;

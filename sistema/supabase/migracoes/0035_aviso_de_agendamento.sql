-- ============================================================
-- BARBOS — migração 0035: aviso de agendamento no celular
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001, 0002, 0014, 0015 e 0033. Pode rodar mais de uma vez.
--
-- Quando alguém marca pelo link público, o celular da barbearia toca —
-- mesmo com o BARBOS fechado. É Web Push: o navegador do aparelho
-- guarda uma assinatura, e o servidor manda a mensagem para o serviço
-- de push da Apple ou do Google, que entrega.
--
-- ============================================================
-- O PROBLEMA DIFÍCIL AQUI: QUEM MARCA NÃO TEM SESSÃO
-- ============================================================
--
-- As assinaturas são da barbearia e o RLS as fecha por `auth.uid()`.
-- Mas quem acabou de marcar é um visitante sem conta nenhuma, e é
-- NESSE instante que o aviso precisa sair. A ação de servidor que
-- grava o agendamento fala com o banco pela chave `anon`, que não
-- enxerga linha nenhuma dessa tabela — e a chave `service_role`, que
-- veria tudo, é proibida neste projeto.
--
-- A saída é `avisar_agendamento`, aqui embaixo: `security definer`,
-- mas com três travas que a tornam inútil para quem não acabou de
-- marcar de verdade:
--
--   1. exige o ID de um agendamento que EXISTE;
--   2. recusa agendamento com mais de 2 minutos de vida;
--   3. é de TIRO ÚNICO — carimba `avisado_em` e a segunda chamada
--      volta vazia.
--
-- Então varrer assinaturas exigiria criar um agendamento de verdade
-- por leitura, dentro de uma janela de dois minutos, e ainda assim o
-- que sai dali não serve de nada sem a nossa chave VAPID privada, que
-- vive só no servidor. O carimbo também dá idempotência de graça: se a
-- ação repetir, o cliente não é avisado duas vezes.
--
-- Endurecer mais significa mover o envio para uma Edge Function com a
-- chave VAPID guardada lá, e aí as assinaturas nunca saem do banco.
-- Fica anotado como o próximo passo, não como dívida esquecida.
-- ============================================================

-- ------------------------------------------------------------
-- de onde o aviso sai
-- ------------------------------------------------------------

alter table public.agendamentos
  add column if not exists avisado_em timestamptz;

comment on column public.agendamentos.avisado_em is
  'Quando o aviso de agendamento online saiu. Null = ainda nao avisado.';

-- ------------------------------------------------------------
-- os aparelhos que recebem
-- ------------------------------------------------------------

create table if not exists public.assinaturas_push (
  id            uuid primary key default gen_random_uuid(),

  barbearia_id  uuid not null default auth.uid()
                  references public.barbearias(id) on delete cascade,

  -- O endereço que o serviço de push (Apple, Google) deu a ESTE
  -- aparelho. É único no mundo: o mesmo navegador assinando de novo
  -- devolve o mesmo endpoint, e é por isso que a chave é ele e não o
  -- par (barbearia, aparelho).
  endpoint      text not null unique,

  -- As duas chaves da assinatura. Sem elas a mensagem não pode ser
  -- cifrada, e Web Push não aceita mensagem em claro.
  p256dh        text not null,
  auth          text not null,

  -- "iPhone da Dani", "balcão". Para a dona reconhecer na lista o que
  -- está desligando — oito aparelhos sem nome não se distinguem.
  aparelho      text,

  criado_em        timestamptz not null default now(),
  ultimo_envio_em  timestamptz,
  -- Guarda o motivo da última recusa do serviço de push. Assinatura que
  -- morre em silêncio é como o aviso para de chegar sem ninguém notar.
  ultima_falha     text,

  constraint aparelho_valido check (
    aparelho is null or length(btrim(aparelho)) between 1 and 40
  )
);

comment on table public.assinaturas_push is
  'Aparelhos que recebem aviso de agendamento online. Um por navegador.';

create index if not exists assinaturas_da_barbearia_idx
  on public.assinaturas_push (barbearia_id, criado_em desc);

alter table public.assinaturas_push enable row level security;

drop policy if exists "assinaturas da propria barbearia" on public.assinaturas_push;
create policy "assinaturas da propria barbearia" on public.assinaturas_push
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- ------------------------------------------------------------
-- avisar_agendamento — o que o servidor precisa para mandar o aviso
--
-- Devolve o recado pronto E os aparelhos, numa chamada só. As três
-- travas estão explicadas no cabeçalho deste arquivo.
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
  select a.id, a.barbearia_id, a.cliente_nome, a.data, a.horario,
         a.avisado_em, a.criado_em,
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
      'clienteNome', v_a.cliente_nome,
      'data',        to_char(v_a.data, 'YYYY-MM-DD'),
      'horario',     to_char(v_a.horario, 'HH24:MI'),
      'servico',     v_a.servico,
      'barbeiro',    coalesce(v_a.barbeiro, ''),
      'barbearia',   v_a.barbearia
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

-- ------------------------------------------------------------
-- descartar_assinatura_push — quando o serviço de push diz que morreu
--
-- O navegador desinstalado ou com a permissão revogada devolve 404/410.
-- Guardar essa assinatura para sempre faria toda marcação futura gastar
-- uma tentativa num endereço que não existe mais.
--
-- Aberta ao `anon` de propósito: quem descobre a morte é o envio, que
-- roda sem sessão. Apagar um endereço que o próprio serviço de push
-- declarou morto não tira nada de ninguém — e o endpoint já tem que
-- estar em mãos para a chamada fazer qualquer coisa.
-- ------------------------------------------------------------

create or replace function public.descartar_assinatura_push(
  p_endpoint text
)
returns void
language sql
security definer
volatile
set search_path = public
as $$
  delete from public.assinaturas_push where endpoint = p_endpoint;
$$;

revoke all on function public.descartar_assinatura_push(text) from public;
grant execute on function public.descartar_assinatura_push(text) to anon, authenticated;

-- ------------------------------------------------------------
-- criar_agendamento_publico_por_chave — devolve o id do que gravou
--
-- Sem o id, a ação de servidor não teria o que passar para
-- `avisar_agendamento`. O resto do corpo é o mesmo da 0033.
-- ------------------------------------------------------------

create or replace function public.criar_agendamento_publico_por_chave(
  p_chave text,
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
    p_data, p_horario, p_observacao);

  if not coalesce((v_r->>'ok')::boolean, false) then
    return v_r;
  end if;

  -- O id do que acabou de entrar. `criar_agendamento_publico` não o
  -- devolve, e mexer nela seria mexer na função que a produção já usa
  -- pelo caminho do apelido — então ele é lido aqui, pela chave
  -- natural do agendamento.
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
  text, text, uuid, uuid, date, time, text) from public;
grant execute on function public.criar_agendamento_publico_por_chave(
  text, text, uuid, uuid, date, time, text) to anon, authenticated;

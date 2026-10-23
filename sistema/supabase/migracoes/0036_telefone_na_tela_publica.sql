-- ============================================================
-- BARBOS — migração 0036: o telefone chega na tela pública
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0031. Pode rodar mais de uma vez.
--
-- Quem marca pelo link é mandado para o WhatsApp da barbearia com a
-- mensagem pronta — nome, dia, hora, serviço e barbeiro. Para isso o
-- número precisa chegar ao navegador de quem está marcando.
--
-- ============================================================
-- ISSO REVERTE UMA ESCOLHA ANTIGA, E DE PROPÓSITO
-- ============================================================
--
-- A view `public.lojas` expõe id, apelido e nome — e NÃO o telefone,
-- deliberadamente (ver "A loja é aberta" no AGENTS.md). A regra continua
-- valendo lá: a vitrine não precisa do número para nada.
--
-- Aqui precisa. Sem o telefone não existe para onde redirecionar, e o
-- Gabriel decidiu em 23/10/2026 que tudo bem — numa barbearia o número
-- costuma estar na fachada e no Google. A consequência, escrita para
-- quem vier depois: QUALQUER UM COM O LINK DE AGENDAMENTO VÊ O NÚMERO.
-- Se um dia a barbearia quiser um número só para isso, o lugar é um
-- campo novo em `barbearias`, não um `if` na tela.
--
-- Só a tela de AGENDAR recebe. A loja segue sem.
-- ============================================================

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
  v_tel   text;
  v_cfg   record;
  v_folga boolean;
begin
  select b.id, b.nome, b.telefone into v_id, v_nome, v_tel
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  select c.dias_atendimento, c.abre, c.fecha, c.por_turno,
         c.manha_abre, c.manha_fecha,
         c.tarde_abre, c.tarde_fecha, c.passo_min
  into v_cfg
  from public.configuracao_agenda c
  where c.barbearia_id = v_id;

  select exists (
    select 1 from public.folgas f
    where f.barbearia_id = v_id and f.data = p_data
  ) into v_folga;

  return jsonb_build_object(
    'ok', true,
    'barbearia', jsonb_build_object(
      'id', v_id, 'nome', v_nome, 'slug', p_slug,
      -- Novo na 0036. Null quando a barbearia não cadastrou número — e aí
      -- a tela simplesmente não oferece o WhatsApp.
      'telefone', v_tel),
    'folga', v_folga,

    'configuracao', jsonb_build_object(
      'diasAtendimento', coalesce(to_jsonb(v_cfg.dias_atendimento), '[1,2,3,4,5,6]'::jsonb),
      'abre',  coalesce(to_char(v_cfg.abre,  'HH24:MI'), '09:00'),
      'fecha', coalesce(to_char(v_cfg.fecha, 'HH24:MI'), '19:00'),
      'porTurno', coalesce(v_cfg.por_turno, false),
      'passoMin', coalesce(v_cfg.passo_min, 15),
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

comment on function public.agenda_publica is
  'Agenda publica por apelido. Traz o telefone desde a 0036, para o aviso no WhatsApp.';

revoke all on function public.agenda_publica(text, date) from public;
grant execute on function public.agenda_publica(text, date) to anon, authenticated;

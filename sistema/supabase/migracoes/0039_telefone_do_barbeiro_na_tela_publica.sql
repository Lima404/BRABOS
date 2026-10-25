-- ============================================================
-- BARBOS — migração 0039: o telefone do BARBEIRO na tela pública
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0014 e 0036. Pode rodar mais de uma vez.
--
-- Quem marca passa a ser mandado para o WhatsApp do barbeiro que
-- escolheu, e não para o número geral da barbearia. Quem corta o cabelo
-- é quem sabe remarcar, atrasar dez minutos e avisar que vai faltar.
--
-- ============================================================
-- ISSO TORNA PÚBLICO O CELULAR DE CADA BARBEIRO
-- ============================================================
--
-- A 0018 escreveu, em letras: a RPC pública devolve os barbeiros SEM
-- telefone, de propósito. A 0036 reverteu isso para o número da
-- BARBEARIA, com a consequência na mesa. Esta migração faz o mesmo para
-- a equipe — e a diferença não é pequena: o número da barbearia é da
-- empresa, o do barbeiro é da PESSOA, e a conta que decide não é a dele.
--
-- A consequência, escrita para quem vier depois: QUALQUER UM COM O LINK
-- DE AGENDAMENTO VÊ O CELULAR DE TODOS OS BARBEIROS ATIVOS. Não só de
-- quem ele escolheu — a lista inteira desce para o navegador junto com a
-- tela, porque é ela que monta o seletor.
--
-- Decisão do Gabriel em 25/10/2026, pedida nestas palavras: "sempre que
-- eu selecionar um barbeiro, a mensagem vai ser redirecionada para ele".
--
-- Se um dia a equipe quiser um número de trabalho separado do pessoal, o
-- lugar é uma coluna nova em `barbeiros` (`telefone_publico`), lida aqui
-- — nunca um `if` na tela, que qualquer um contorna abrindo a resposta
-- da RPC no navegador.
--
-- A vitrine da loja (`public.lojas`) continua sem telefone nenhum.
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
      -- Novo na 0036. Vira a RESERVA desde a 0039: o cliente é mandado
      -- para o barbeiro, e só cai aqui quando o barbeiro não tem número.
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
      select jsonb_agg(jsonb_build_object(
               'id', b.id,
               'nome', b.nome,
               -- Novo na 0039. `nullif` porque a 0014 só garante que a
               -- coluna não é nula, não que tem número de verdade: uma
               -- linha antiga pode trazer espaço em branco, e aí a tela
               -- precisa saber que não dá para redirecionar.
               'telefone', nullif(btrim(b.telefone), '')
             ) order by b.nome)
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
  'Agenda publica por apelido. Traz o telefone da barbearia (0036) e o de cada barbeiro (0039).';

revoke all on function public.agenda_publica(text, date) from public;
grant execute on function public.agenda_publica(text, date) to anon, authenticated;

-- ============================================================
-- BARBOS — migração 0010: o nome do cliente aparece no seletor da loja
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende da 0009. Pode rodar mais de uma vez.
--
-- O que muda: `clientes_do_dia_loja` passa a devolver `cliente_nome` para
-- QUALQUER pessoa, e não só para a dona logada.
--
-- Decisão do Gabriel, tomada com o efeito na mesa: `/loja/<slug>` abre sem
-- sessão, então isto torna público o nome e o horário de quem tem hora
-- marcada hoje — para qualquer um com o link, não só para quem está na
-- barbearia. Foi pedido duas vezes; a 0009 guarda a versão que escondia, e
-- voltar atrás é rodar aquele bloco de novo.
--
-- Só o dia corrente sai daqui: `p_data` vem de quem chama e a agenda de
-- ontem ou de amanhã continua fechada.
-- ============================================================

create or replace function public.clientes_do_dia_loja(
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
  v_loja_id uuid;
begin
  select b.id into v_loja_id
  from public.barbearias b
  where b.slug = p_slug
    and b.loja_ativa
  limit 1;

  if v_loja_id is null then
    return '[]'::jsonb;
  end if;

  return coalesce(
    (
      select jsonb_agg(linha order by linha->>'horario')
      from (
        select jsonb_build_object(
                 'id', a.id,
                 'horario', to_char(a.horario, 'HH24:MI'),
                 'servico', s.nome,
                 'clienteNome', a.cliente_nome
               ) as linha
        from public.agendamentos a
        join public.servicos s on s.id = a.servico_id
        where a.barbearia_id = v_loja_id
          and a.data = p_data
          -- Cancelado e falta não compram nada: quem não veio não leva.
          and a.estado not in ('cancelado', 'faltou')
      ) as linhas
    ),
    '[]'::jsonb
  );
end $$;

comment on function public.clientes_do_dia_loja is
  'Agendamentos do dia para o seletor da loja, com o nome do cliente. Lista pública — ver o cabeçalho da migração 0010.';

revoke all on function public.clientes_do_dia_loja(text, date) from public;
grant execute on function public.clientes_do_dia_loja(text, date)
  to anon, authenticated;

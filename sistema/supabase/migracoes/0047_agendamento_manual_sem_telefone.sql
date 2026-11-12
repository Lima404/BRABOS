-- ============================================================
-- BARBOS — migração 0047: agendamento manual sem telefone
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende da 0043. Pode rodar mais de uma vez.
--
-- Compatível com o código no ar: só AFROUXA um gatilho. O código antigo
-- sempre manda cliente, e continua passando.
--
-- ============================================================
-- A REGRA (Gabriel, 12/11/2026)
-- ============================================================
--
-- Na AGENDA da barbearia, o telefone do cliente deixa de ser
-- obrigatório: o barbeiro marca o avulso que chegou na porta ou ligou, e
-- nem sempre tem o número. Sem telefone não há cadastro de cliente — o
-- agendamento guarda só o nome em `cliente_nome`, o mesmo formato dos
-- antigos de antes da 0037. O `check` da 0043 (cliente OU nome, nunca os
-- dois, nunca nenhum) continua valendo igual.
--
-- No LINK de agendamento (página pública) nada muda: o telefone continua
-- obrigatório. Duas barreiras seguem de pé lá:
--   - a RPC pública exige o telefone e sempre grava com cliente;
--   - este gatilho: a página pública roda sem sessão (`auth.uid()` nulo),
--     então a exceção abaixo nunca vale para ela.
-- ============================================================

-- Agendamento NOVO sem cliente só quando quem grava é a própria
-- barbearia, logada (a agenda dela). Qualquer outro caminho continua
-- precisando de cliente.
create or replace function public.agendamento_novo_tem_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.cliente_id is null
     and auth.uid() is distinct from new.barbearia_id then
    raise exception 'Agendamento novo precisa de um cliente (telefone com DDD).'
      using errcode = '23502';
  end if;
  return new;
end $$;

revoke all on function public.agendamento_novo_tem_cliente() from public, anon, authenticated;

notify pgrst, 'reload schema';

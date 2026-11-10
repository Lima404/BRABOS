-- ============================================================
-- BARBOS — migração 0043: agendamento novo só com cliente
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0042. Pode rodar mais de uma vez.
--
-- É o "DEPOIS DO DEPLOY" que a 0042 deixou marcado. NÃO RODAR antes de as
-- telas novas (que gravam `cliente_id`) estarem no ar: o código antigo
-- grava `cliente_telefone`, e esta migração apaga a coluna.
--
-- ============================================================
-- O QUE MUDA
-- ============================================================
--
-- * Sai o gatilho de transição `agendamento_com_cliente`. Ele traduzia o
--   código antigo e copiava o cadastro de volta para as colunas antigas;
--   sem código antigo no ar, não tem mais o que traduzir.
--
-- * Sai `agendamentos.cliente_telefone`. O telefone mora em `clientes`.
--
-- * `agendamentos.cliente_nome` fica SÓ nos antigos sem telefone, como
--   histórico (decisão 4 da 0042). Nos outros vira null — o nome deles
--   está no cadastro, e quando o agendamento era de outra pessoa, o nome
--   dela já está em `nome_atendido` desde a 0042.
--
-- * `nome_atendido` só existe em agendamento com cliente: ele diz quem
--   senta na cadeira quando não é o dono do telefone, e sem telefone não
--   há dono.
--
-- * Cada agendamento tem UM dos dois: o cliente OU o nome antigo. E linha
--   NOVA sem cliente é recusada: o telefone é obrigatório.
-- ============================================================


-- ------------------------------------------------------------
-- 1. O que o código antigo ainda gravou entre a 0042 e o deploy
-- ------------------------------------------------------------
-- O gatilho de transição já ligava na hora. Isto é a rede de baixo,
-- igual à da 0042 (com `nome_atendido` quando o nome não bate com o
-- cadastro). Só roda enquanto
-- `cliente_telefone` existir: na segunda vez a coluna já saiu, e um SQL
-- que a citasse direto nem compilaria.
alter table public.agendamentos disable trigger tocar_agendamentos;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'agendamentos'
      and column_name = 'cliente_telefone'
  ) then
    execute $sql$
      insert into public.clientes (barbearia_id, nome, telefone, criado_em)
      select distinct on (a.barbearia_id, t.tel)
             a.barbearia_id,
             btrim(a.cliente_nome),
             t.tel,
             min(a.criado_em) over (partition by a.barbearia_id, t.tel)
      from public.agendamentos a
      cross join lateral (select public.normalizar_telefone(a.cliente_telefone) as tel) t
      where a.cliente_id is null
        and t.tel ~ '^[0-9]{10,11}$'
        and length(btrim(coalesce(a.cliente_nome, ''))) between 1 and 80
      order by a.barbearia_id, t.tel, a.data desc, a.horario desc, a.criado_em desc
      on conflict (barbearia_id, telefone) do nothing
    $sql$;

    execute $sql$
      update public.agendamentos a
         set cliente_id = c.id,
             nome_atendido = case
               when public.normalizar_nome(a.cliente_nome) <> public.normalizar_nome(c.nome)
                 then left(btrim(a.cliente_nome), 80)
             end
        from public.clientes c
       where a.cliente_id is null
         and c.barbearia_id = a.barbearia_id
         and c.telefone = public.normalizar_telefone(a.cliente_telefone)
    $sql$;
  end if;
end $$;


-- ------------------------------------------------------------
-- 2. Sai a transição
-- ------------------------------------------------------------
drop trigger if exists agendamento_com_cliente on public.agendamentos;
drop function if exists public.agendamento_com_cliente();


-- ------------------------------------------------------------
-- 3. O nome copiado fica só no histórico; o telefone copiado sai
-- ------------------------------------------------------------
update public.agendamentos
   set cliente_nome = null
 where cliente_id is not null
   and cliente_nome is not null;

alter table public.agendamentos enable trigger tocar_agendamentos;

alter table public.agendamentos drop constraint if exists agendamento_telefone_com_ddd;
alter table public.agendamentos drop column if exists cliente_telefone;


-- ------------------------------------------------------------
-- 4. Um dos dois, nunca os dois, nunca nenhum
-- ------------------------------------------------------------
do $$
begin
  alter table public.agendamentos
    add constraint agendamento_cliente_ou_nome_antigo
    check ((cliente_id is null) <> (cliente_nome is null));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.agendamentos
    add constraint agendamento_atendido_so_com_cliente
    check (nome_atendido is null or cliente_id is not null);
exception when duplicate_object then null;
end $$;

-- E linha NOVA, só com cliente. É gatilho e não `check` porque a regra é
-- sobre o MOMENTO: o antigo sem telefone continua valendo e continua
-- editável (sem telefone, a dona não tem como descobrir o número de
-- quem passou aqui em agosto).
create or replace function public.agendamento_novo_tem_cliente()
returns trigger
language plpgsql
as $$
begin
  if new.cliente_id is null then
    raise exception 'Agendamento novo precisa de um cliente (telefone com DDD).'
      using errcode = '23502';
  end if;
  return new;
end $$;

revoke all on function public.agendamento_novo_tem_cliente() from public, anon, authenticated;

drop trigger if exists agendamento_novo_tem_cliente on public.agendamentos;
create trigger agendamento_novo_tem_cliente
  before insert on public.agendamentos
  for each row execute function public.agendamento_novo_tem_cliente();

notify pgrst, 'reload schema';

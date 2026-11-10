-- ============================================================
-- BARBOS — migração 0042: o cliente vira cadastro
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0033, 0035, 0037 e 0038. Pode rodar mais de uma vez.
--
-- Esta é a PRIMEIRA de duas. A 0043 aperta depois do deploy das telas
-- novas — a mesma ordem da 0037/0038: migração frouxa, deploy, migração
-- que aperta.
--
-- ============================================================
-- POR QUE ISTO EXISTE
-- ============================================================
--
-- Até aqui o nome e o telefone do cliente eram COPIADOS em cada
-- agendamento. O mesmo cliente em dez horários eram dez cópias, e cada
-- uma do jeito que foi digitada: medido em 10/11/2026, 238 telefones
-- gravados só com números e 238 com máscara. Não havia como saber, com
-- segurança, que dois agendamentos eram da mesma pessoa.
--
-- Agora o cliente é uma linha em `clientes`, e o agendamento aponta para
-- ela (`cliente_id`). O agendamento guarda só o que é DELE: serviço,
-- barbeiro, data, hora, observação, estado, preço e duração.
--
-- ============================================================
-- AS DECISÕES (Gabriel, 10/11/2026)
-- ============================================================
--
-- 1. CLIENTE É DA BARBEARIA, não um cadastro único do BARBOS. O mesmo
--    telefone em duas barbearias são duas linhas. Não é repetição: cada
--    barbearia tem a sua relação com o cliente (e o chama do seu jeito),
--    e nenhuma enxerga a lista da outra. Um cadastro único deixaria
--    qualquer pessoa, digitando números numa página pública, descobrir
--    nomes da base inteira.
--
--    O agendamento aponta para o cliente E para a barbearia, e a chave
--    estrangeira é COMPOSTA — (barbearia_id, cliente_id) → clientes
--    (barbearia_id, id). É ela que torna impossível um agendamento da
--    barbearia A apontar para um cliente da barbearia B. O `barbearia_id`
--    repetido não é redundância que possa divergir: o banco recusa a
--    divergência.
--
-- 2. A TELA PÚBLICA DEVOLVE O NOME RESUMIDO (`cliente_publico`): o
--    primeiro nome e a inicial do sobrenome, "GABRIEL L.". Ela abre sem
--    sessão, e dá para testar telefones nela. O nome inteiro fica para a
--    barbearia, sob o RLS.
--
--    E quem DIGITA o nome na tela pública escreve nome E sobrenome
--    (pedido do Gabriel, 10/11/2026). O banco cobra isso de cliente novo;
--    quem já tem cadastro não digita nada.
--
-- 3. UM TELEFONE, UM CLIENTE (`unique (barbearia_id, telefone)`), e o
--    agendamento diz QUEM É ATENDIDO quando não é o dono do telefone
--    (`agendamentos.nome_atendido`). Os casos reais:
--
--      * o pai que marca para o filho;
--      * o cliente avulso que chega sem telefone, e o barbeiro põe o
--        PRÓPRIO número porque o campo é obrigatório. Medido em
--        10/11/2026: 108 agendamentos da Olliverr no número do barbeiro,
--        com 59 nomes diferentes; 10 na BARBOS.
--
--    O telefone de um barbeiro ou da barbearia vira cliente com o nome
--    DA CASA, e cada avulso fica em `nome_atendido`. A agenda mostra
--    `nome_atendido` quando existe, e o nome do cadastro quando não.
--
--    Não é repetição: o cadastro é o dono do telefone (o contato), e
--    `nome_atendido` é quem senta na cadeira — outra informação, gravada
--    só quando é diferente.
--
--    A tela pública NUNCA troca o nome do cadastro — senão quem digitasse
--    o telefone de outra pessoa trocaria o nome dela. Na agenda interna,
--    logada, a barbearia escolhe: corrigir o cadastro, ou outra pessoa
--    neste horário (o padrão, porque é o que não estraga o cadastro).
--
-- 4. AGENDAMENTO ANTIGO SEM TELEFONE FICA SEM CLIENTE. São 321, todos de
--    datas passadas, de antes de o campo existir (0037). O nome deles
--    continua em `agendamentos.cliente_nome`, como histórico. Dava para
--    ligar 79 pelo nome, mas um "LUCAS" sem telefone em agosto pode não
--    ser o LUCAS com telefone — e ligar errado é pior que não ligar.
--
-- 5. PREÇO E DURAÇÃO CONTINUAM COPIADOS NO AGENDAMENTO. É a única
--    repetição que fica, de propósito (ver AGENTS.md): reajuste de tabela
--    não reescreve o histórico.
--
-- ============================================================
-- O TELEFONE GUARDADO SÓ COM NÚMEROS
-- ============================================================
--
-- `normalizar_telefone` é a ÚNICA cópia da regra: tira máscara, zero da
-- frente e o 55 do país (só com 12 ou 13 dígitos — 55 também é o DDD de
-- Santa Maria), e põe o 9 no celular antigo de 10 dígitos. O gatilho de
-- `clientes` aplica sempre, então nenhuma tela precisa lembrar. A máscara
-- é coisa da tela.
--
-- ============================================================
-- COMPATÍVEL COM O CÓDIGO QUE ESTÁ NO AR
-- ============================================================
--
-- O banco é o mesmo da produção. Entre esta migração e o deploy, o código
-- antigo continua gravando `cliente_nome` e `cliente_telefone` direto no
-- agendamento. O gatilho de TRANSIÇÃO (`agendamento_com_cliente`) traduz:
-- acha ou cria o cliente pelo telefone e liga. E faz o caminho de volta —
-- copia nome e telefone do cadastro para as colunas antigas —, para que
-- voltar o deploy, se preciso, não mostre agenda sem nome.
--
-- As RPCs públicas mantêm a MESMA assinatura: a tela antiga continua
-- marcando, e a nova manda o nome vazio quando o cliente já existe.
--
-- A 0043 apaga o gatilho de transição e a coluna `cliente_telefone`.
-- ============================================================


-- ------------------------------------------------------------
-- 1. O telefone, do jeito que o banco guarda
-- ------------------------------------------------------------
create or replace function public.normalizar_telefone(p_texto text)
returns text
language plpgsql
immutable
as $$
declare
  d text := ltrim(regexp_replace(coalesce(p_texto, ''), '[^0-9]', '', 'g'), '0');
begin
  if d = '' then
    return null;
  end if;

  -- Veio com o país na frente: 55 + DDD + número.
  if length(d) in (12, 13) and left(d, 2) = '55' then
    d := substr(d, 3);
  end if;

  -- Celular antigo, sem o 9: DDD + 8 dígitos começando de 6 a 9.
  -- Fixo começa de 2 a 5 e fica como está.
  if length(d) = 10 and substr(d, 3, 1) between '6' and '9' then
    d := left(d, 2) || '9' || substr(d, 3);
  end if;

  return d;
end $$;

comment on function public.normalizar_telefone(text) is
  'Telefone só com números, DDD + número, com o 9 do celular. Única cópia da regra.';

-- A chave de comparação de nomes da 0024. O AGENTS.md dizia que ela
-- sobreviveu à 0025, mas em 10/11/2026 ela NÃO existia no banco de
-- produção. Volta aqui com o mesmo corpo, porque `nome_atendido` depende
-- dela: "Gabriel " e "GABRIEL" são o mesmo nome, não outra pessoa.
create or replace function public.normalizar_nome(p_texto text)
returns text
language sql
immutable
strict
as $$
  select regexp_replace(
    lower(
      translate(
        btrim(p_texto),
        'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
        'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
      )
    ),
    '\s+', ' ', 'g'
  )
$$;

comment on function public.normalizar_nome(text) is
  'Chave de comparação de nomes: sem acento, minúsculo, espaços colapsados.';


-- ------------------------------------------------------------
-- 2. A tabela
-- ------------------------------------------------------------
create table if not exists public.clientes (
  id             uuid primary key default gen_random_uuid(),
  barbearia_id   uuid not null default auth.uid()
                 references public.barbearias(id) on delete cascade,
  nome           text not null,
  telefone       text not null,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  constraint clientes_nome_preenchido check (length(btrim(nome)) between 1 and 80),
  constraint clientes_telefone_com_ddd check (telefone ~ '^[0-9]{10,11}$'),
  constraint clientes_um_por_telefone unique (barbearia_id, telefone),
  -- Alvo da chave composta do agendamento (decisão 1).
  constraint clientes_da_barbearia unique (barbearia_id, id)
);

comment on table public.clientes is
  'Cliente da barbearia: nome e telefone, uma linha por telefone em cada barbearia.';

create index if not exists clientes_barbearia_nome_idx
  on public.clientes (barbearia_id, nome);

create or replace function public.arrumar_cliente()
returns trigger
language plpgsql
as $$
begin
  new.telefone := public.normalizar_telefone(new.telefone);
  new.nome := btrim(regexp_replace(coalesce(new.nome, ''), '\s+', ' ', 'g'));
  return new;
end $$;

-- Os gatilhos rodam em ordem alfabética: "arrumar" antes de "tocar".
drop trigger if exists arrumar_cliente on public.clientes;
create trigger arrumar_cliente
  before insert or update of nome, telefone on public.clientes
  for each row execute function public.arrumar_cliente();

drop trigger if exists tocar_clientes on public.clientes;
create trigger tocar_clientes
  before update on public.clientes
  for each row execute function public.tocar_atualizado_em();

alter table public.clientes enable row level security;

drop policy if exists "clientes da propria barbearia" on public.clientes;
create policy "clientes da propria barbearia" on public.clientes
  for all
  using (barbearia_id = auth.uid())
  with check (barbearia_id = auth.uid());

-- Dado pessoal: quem não tem sessão não chega nem perto da tabela. A tela
-- pública passa por `cliente_publico`, que devolve só o primeiro nome.
revoke all on public.clientes from anon;


-- ------------------------------------------------------------
-- 3. O agendamento aponta para o cliente
-- ------------------------------------------------------------
alter table public.agendamentos
  add column if not exists cliente_id uuid;

-- Quem senta na cadeira, quando não é o dono do telefone (decisão 3).
alter table public.agendamentos
  add column if not exists nome_atendido text;

do $$
begin
  alter table public.agendamentos
    add constraint agendamento_nome_atendido_preenchido
    check (nome_atendido is null or length(btrim(nome_atendido)) between 1 and 80);
exception when duplicate_object then null;
end $$;

comment on column public.agendamentos.nome_atendido is
  'Quem é atendido, quando não é o dono do telefone (filho, avulso no número do barbeiro). Null = o próprio cliente.';

-- Composta, e sem `on delete`: o padrão (NO ACTION) confere no FIM do
-- comando. Apagar uma barbearia leva os clientes E os agendamentos pelo
-- cascata, e um RESTRICT aqui conferiria no meio, antes de o cascata
-- chegar aos agendamentos — virando a quarta trava a contornar no
-- `apagar-barbearia.sql`. Apagar um cliente que tem horário continua
-- recusado (23503), que é o certo: o histórico é dele.
do $$
begin
  alter table public.agendamentos
    add constraint agendamentos_cliente_da_mesma_barbearia
    foreign key (barbearia_id, cliente_id)
    references public.clientes (barbearia_id, id);
exception when duplicate_object then null;
end $$;

create index if not exists agendamentos_cliente_idx
  on public.agendamentos (cliente_id, data desc)
  where cliente_id is not null;

-- Linha nova não precisa mais do nome copiado. Daqui até a 0043 ele fica
-- só nos antigos sem telefone — e o gatilho de transição o preenche nos
-- outros, para o código antigo continuar lendo.
alter table public.agendamentos
  alter column cliente_nome drop not null;

comment on column public.agendamentos.cliente_nome is
  'Só em agendamento antigo sem telefone (sem cliente). O nome de quem tem cadastro mora em clientes.';


-- ------------------------------------------------------------
-- 4. Achar ou criar o cliente pelo telefone
-- ------------------------------------------------------------
-- Só para uso por dentro do banco (RPC pública, `salvar_cliente`, gatilho
-- de transição). Ela recebe o `barbearia_id` de quem chama, então não
-- pode estar aberta para a API — quem a chama é que decide de qual
-- barbearia é.
create or replace function public.cliente_da_barbearia(
  p_barbearia uuid,
  p_telefone  text,
  p_nome      text,
  p_renomear  boolean default false
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_tel  text := public.normalizar_telefone(p_telefone);
  v_nome text := nullif(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), '');
  v_casa text;
  v_id   uuid;
begin
  if p_barbearia is null or v_tel is null or v_tel !~ '^[0-9]{10,11}$' then
    return null;
  end if;

  select c.id into v_id
  from public.clientes c
  where c.barbearia_id = p_barbearia and c.telefone = v_tel;

  if v_id is not null then
    if p_renomear and v_nome is not null then
      update public.clientes
         set nome = v_nome
       where id = v_id and nome is distinct from v_nome;
    end if;
    return v_id;
  end if;

  -- Cliente novo precisa de nome.
  if v_nome is null then
    return null;
  end if;

  -- O telefone DA CASA (de um barbeiro ou da própria barbearia) nasce com
  -- o nome da casa: quem chega por ele é avulso, e cada um fica em
  -- `nome_atendido` do agendamento (decisão 3). Sem isto o cadastro
  -- levaria o nome do primeiro avulso, e o segundo herdaria esse nome.
  select coalesce(
    (select b.nome from public.barbeiros b
      where b.barbearia_id = p_barbearia
        and public.normalizar_telefone(b.telefone) = v_tel
      order by b.ativo desc
      limit 1),
    (select ba.nome from public.barbearias ba
      where ba.id = p_barbearia
        and public.normalizar_telefone(ba.telefone) = v_tel)
  ) into v_casa;

  -- `on conflict`: duas marcações do mesmo telefone novo no mesmo segundo.
  insert into public.clientes (barbearia_id, nome, telefone)
  values (p_barbearia, coalesce(nullif(btrim(v_casa), ''), v_nome), v_tel)
  on conflict (barbearia_id, telefone) do update
    set nome = case when p_renomear then excluded.nome else public.clientes.nome end
  returning id into v_id;

  return v_id;
end $$;

revoke all on function public.cliente_da_barbearia(uuid, text, text, boolean)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. Os dados de hoje viram cadastro
-- ------------------------------------------------------------
-- Um cliente por telefone, desde o primeiro agendamento. O nome é o DA
-- CASA quando o telefone é de um barbeiro ou da barbearia (decisão 3), e
-- o do agendamento MAIS RECENTE nos outros. `tocar_agendamentos` fica
-- desligado só aqui: ligar o cliente não é editar o agendamento, e
-- `atualizado_em` mentiria em todas as linhas.
alter table public.agendamentos disable trigger tocar_agendamentos;

insert into public.clientes (barbearia_id, nome, telefone, criado_em)
select distinct on (a.barbearia_id, t.tel)
       a.barbearia_id,
       coalesce(
         (select left(btrim(b.nome), 80) from public.barbeiros b
           where b.barbearia_id = a.barbearia_id
             and public.normalizar_telefone(b.telefone) = t.tel
           order by b.ativo desc
           limit 1),
         (select left(btrim(ba.nome), 80) from public.barbearias ba
           where ba.id = a.barbearia_id
             and public.normalizar_telefone(ba.telefone) = t.tel),
         btrim(a.cliente_nome)
       ),
       t.tel,
       min(a.criado_em) over (partition by a.barbearia_id, t.tel)
from public.agendamentos a
cross join lateral (select public.normalizar_telefone(a.cliente_telefone) as tel) t
where a.cliente_id is null
  and t.tel ~ '^[0-9]{10,11}$'
  and length(btrim(coalesce(a.cliente_nome, ''))) between 1 and 80
order by a.barbearia_id, t.tel, a.data desc, a.horario desc, a.criado_em desc
on conflict (barbearia_id, telefone) do nothing;

-- Liga, e guarda em `nome_atendido` o nome que não bate com o cadastro
-- (decisão 3). Só onde ainda não ligou: rodar de novo não mexe em nada.
update public.agendamentos a
   set cliente_id = c.id,
       nome_atendido = case
         when public.normalizar_nome(a.cliente_nome) <> public.normalizar_nome(c.nome)
           then left(btrim(a.cliente_nome), 80)
       end
  from public.clientes c
 where a.cliente_id is null
   and c.barbearia_id = a.barbearia_id
   and c.telefone = public.normalizar_telefone(a.cliente_telefone);

alter table public.agendamentos enable trigger tocar_agendamentos;


-- ------------------------------------------------------------
-- 6. O gatilho de TRANSIÇÃO (sai na 0043)
-- ------------------------------------------------------------
-- `security definer` porque o código antigo grava como `authenticated` e
-- o gatilho precisa de `cliente_da_barbearia`, que é fechada. Não abre
-- nada: o RLS de `agendamentos` confere o `barbearia_id` da linha depois
-- dos gatilhos BEFORE, e se recusar, o comando inteiro volta — cliente
-- criado junto.
create or replace function public.agendamento_com_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome     text;
  v_tel      text;
  v_digitado text := nullif(btrim(coalesce(new.cliente_nome, '')), '');
begin
  if tg_op = 'INSERT' and new.cliente_id is null and new.cliente_telefone is not null then
    -- Código antigo marcando: veio nome e telefone, sem cliente.
    new.cliente_id := public.cliente_da_barbearia(
      new.barbearia_id, new.cliente_telefone, new.cliente_nome, false);

  elsif tg_op = 'UPDATE'
        and new.cliente_id is not distinct from old.cliente_id
        and new.cliente_telefone is not null
        and new.cliente_telefone is distinct from old.cliente_telefone then
    -- Código antigo editando o telefone: ele não conhece `cliente_id`.
    new.cliente_id := public.cliente_da_barbearia(
      new.barbearia_id, new.cliente_telefone, new.cliente_nome, false);
  end if;

  if new.cliente_id is not null then
    select c.nome, c.telefone into v_nome, v_tel
    from public.clientes c
    where c.id = new.cliente_id and c.barbearia_id = new.barbearia_id;

    -- O código antigo SEMPRE manda o nome digitado, e o novo nunca manda
    -- (ele grava `nome_atendido` direto). Veio nome: ele diz quem é
    -- atendido. Diferente do cadastro = outra pessoa (decisão 3); igual =
    -- o próprio cliente. O código antigo nunca renomeia o cadastro: o
    -- avulso no número do barbeiro renomearia o barbeiro.
    if v_digitado is not null then
      new.nome_atendido := case
        when public.normalizar_nome(v_digitado) <> public.normalizar_nome(v_nome)
          then left(v_digitado, 80)
      end;
    end if;

    -- O caminho de volta: o código antigo lê as colunas copiadas, e
    -- `cliente_nome` é o nome que a agenda dele mostra.
    new.cliente_nome := coalesce(new.nome_atendido, v_nome);
    new.cliente_telefone := v_tel;
  end if;

  return new;
end $$;

revoke all on function public.agendamento_com_cliente() from public, anon, authenticated;

drop trigger if exists agendamento_com_cliente on public.agendamentos;
create trigger agendamento_com_cliente
  before insert or update of cliente_id, cliente_nome, cliente_telefone, nome_atendido
  on public.agendamentos
  for each row execute function public.agendamento_com_cliente();


-- ------------------------------------------------------------
-- 7. O que as telas chamam
-- ------------------------------------------------------------

-- Tela pública: o telefone já é cliente desta barbearia? Devolve o nome
-- RESUMIDO, "GABRIEL L." (decisão 2). A chave resolve como em
-- `criar_agendamento_publico_por_chave`: apelido primeiro, depois convite
-- — e convite vencido, esgotado ou desligado não responde nada.
create or replace function public.cliente_publico(p_chave text, p_telefone text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_id   uuid;
  v_nome text;
  v_tel  text := public.normalizar_telefone(p_telefone);
begin
  if v_tel is null or v_tel !~ '^[0-9]{10,11}$' then
    return null;
  end if;

  select b.id into v_id
  from public.barbearias b
  where b.slug = p_chave
  limit 1;

  if v_id is null then
    select c.barbearia_id into v_id
    from public.convites_agendamento c
    where c.codigo = p_chave
      and not c.revogado
      and (c.expira_em is null or now() < c.expira_em)
      and (c.usos_max is null or c.usos < c.usos_max);
  end if;

  if v_id is null then
    return null;
  end if;

  -- "GABRIEL LIMA" → "GABRIEL L."; "MARIA DA SILVA" → "MARIA S.";
  -- nome de uma palavra só fica como está.
  select case
           when array_length(p.partes, 1) > 1
             then p.partes[1] || ' ' || left(p.partes[array_length(p.partes, 1)], 1) || '.'
           else p.partes[1]
         end
  into v_nome
  from public.clientes cl
  cross join lateral (select regexp_split_to_array(btrim(cl.nome), '\s+') as partes) p
  where cl.barbearia_id = v_id and cl.telefone = v_tel;

  if v_nome is null then
    return jsonb_build_object('encontrado', false);
  end if;

  return jsonb_build_object('encontrado', true, 'nome', v_nome);
end $$;

revoke all on function public.cliente_publico(text, text) from public;
grant execute on function public.cliente_publico(text, text) to anon, authenticated;

-- Agenda interna: o cliente deste telefone, inteiro. Sob o RLS.
create or replace function public.buscar_cliente(p_telefone text)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object('id', c.id, 'nome', c.nome, 'telefone', c.telefone)
  from public.clientes c
  where c.barbearia_id = auth.uid()
    and c.telefone = public.normalizar_telefone(p_telefone)
$$;

revoke all on function public.buscar_cliente(text) from public, anon;
grant execute on function public.buscar_cliente(text) to authenticated;

-- Agenda interna: acha ou cria o cliente do telefone e diz QUEM É ATENDIDO.
-- A barbearia é sempre a da sessão.
--
--   * telefone novo: cria o cliente com o nome digitado (ou o da casa,
--     se o número for de um barbeiro ou da barbearia);
--   * nome igual ao do cadastro: o próprio cliente;
--   * nome diferente e `p_corrigir`: a barbearia corrige o cadastro —
--     logada, ela é dona dele;
--   * nome diferente, sem corrigir: outra pessoa neste horário.
--
-- Devolve `{ "id": ..., "nomeAtendido": ... | null }`, ou null quando o
-- telefone não serve. A regra mora AQUI, e não na tela, para a tela
-- pública e a interna não terem duas versões de "é o mesmo nome?".
create or replace function public.salvar_cliente(
  p_telefone text,
  p_nome     text,
  p_corrigir boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id       uuid;
  v_cadastro text;
  v_nome     text := nullif(btrim(regexp_replace(coalesce(p_nome, ''), '\s+', ' ', 'g')), '');
begin
  if auth.uid() is null then
    raise exception 'Sem sessão.' using errcode = '42501';
  end if;

  v_id := public.cliente_da_barbearia(auth.uid(), p_telefone, v_nome, coalesce(p_corrigir, false));
  if v_id is null then
    return null;
  end if;

  select c.nome into v_cadastro from public.clientes c where c.id = v_id;

  return jsonb_build_object(
    'id', v_id,
    'nomeAtendido', case
      when v_nome is not null
       and public.normalizar_nome(v_nome) <> public.normalizar_nome(v_cadastro)
        then left(v_nome, 80)
    end
  );
end $$;

revoke all on function public.salvar_cliente(text, text, boolean) from public, anon;
grant execute on function public.salvar_cliente(text, text, boolean) to authenticated;


-- ------------------------------------------------------------
-- 8. Marcação pública: o cliente pelo telefone
-- ------------------------------------------------------------
-- Mesma assinatura da 0038 (a tela antiga continua chamando). O que muda:
--   * o nome deixa de ser obrigatório quando o telefone já é cliente;
--   * o agendamento grava `cliente_id`, e não mais nome e telefone;
--   * nome diferente do cadastro vira `nome_atendido` (decisão 3), e o
--     cadastro não muda.
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
  v_id         uuid;
  v_agora      timestamp := now() at time zone 'America/Sao_Paulo';
  v_hoje       date := v_agora::date;
  v_nome       text;
  v_tel        text;
  v_cliente    uuid;
  v_cadastro   text;
  v_atendido   text;
  v_observacao text;
  v_servico    record;
  v_cfg        record;
  v_dias       smallint[];
  v_fim        time;
  v_ok         boolean := false;
  v_rotulo     text;
  v_passo      smallint;
begin
  select b.id into v_id
  from public.barbearias b
  where b.slug = p_slug
  limit 1;

  if v_id is null then
    return jsonb_build_object('ok', false, 'erro', 'Barbearia não encontrada.');
  end if;

  -- ---- telefone: obrigatório desde a 0038 ----
  v_tel := public.normalizar_telefone(p_cliente_telefone);

  -- Uma mensagem só para "não mandou" e "mandou torto": quem está do
  -- outro lado precisa fazer a mesma coisa nos dois casos.
  if v_tel is null or v_tel !~ '^[0-9]{10,11}$' then
    return jsonb_build_object(
      'ok', false,
      'erro', 'Informe seu telefone com DDD (10 ou 11 dígitos).'
    );
  end if;

  -- ---- nome: só obrigatório para quem ainda não é cliente ----
  v_nome := nullif(btrim(coalesce(p_cliente_nome, '')), '');
  if v_nome is not null and (length(v_nome) < 2 or length(v_nome) > 60) then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome (2 a 60 letras).');
  end if;

  select c.id, c.nome into v_cliente, v_cadastro
  from public.clientes c
  where c.barbearia_id = v_id and c.telefone = v_tel;

  if v_cliente is null and v_nome is null then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome e sobrenome.');
  end if;

  -- Cliente novo escreve nome E sobrenome: duas palavras de pelo menos
  -- duas letras. Cobrado aqui porque a RPC é endereço público — a tela é
  -- conveniência.
  if v_cliente is null and (
    select count(*) from regexp_split_to_table(v_nome, '\s+') w where length(w) >= 2
  ) < 2 then
    return jsonb_build_object('ok', false, 'erro', 'Informe seu nome e sobrenome.');
  end if;

  v_observacao := nullif(btrim(coalesce(p_observacao, '')), '');

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

  -- O cliente nasce DENTRO do bloco: se o horário estiver ocupado, a
  -- exceção desfaz até o ponto de salvamento do bloco, e um cliente novo
  -- não fica cadastrado por uma marcação que não aconteceu.
  begin
    if v_cliente is null then
      v_cliente := public.cliente_da_barbearia(v_id, v_tel, v_nome, false);
      -- O nome do cadastro pode não ser o digitado: telefone da casa
      -- nasce com o nome da casa.
      select c.nome into v_cadastro from public.clientes c where c.id = v_cliente;
    end if;

    -- Nome diferente do cadastro: é outra pessoa (decisão 3) — o filho,
    -- ou o avulso no número da casa. O cadastro não muda por aqui.
    if v_nome is not null
       and public.normalizar_nome(v_nome) <> public.normalizar_nome(v_cadastro) then
      v_atendido := v_nome;
    end if;

    insert into public.agendamentos (
      barbearia_id, barbeiro_id, cliente_id, nome_atendido, servico_id,
      data, horario, estado, preco_centavos, duracao_min, observacao
    ) values (
      v_id, p_barbeiro_id, v_cliente, v_atendido, v_servico.id,
      p_data, p_horario, 'agendado',
      v_servico.preco_centavos, v_servico.duracao_min,
      v_observacao
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


-- ------------------------------------------------------------
-- 9. Quem lia o nome no agendamento passa a ler no cadastro
-- ------------------------------------------------------------
-- O nome cai para `cliente_nome` só no agendamento antigo sem cliente.
-- O telefone vem SÓ de `clientes` — `agendamentos.cliente_telefone` sai
-- na 0043, e uma função que ainda o lesse quebraria ali.

create or replace function public.avisar_agendamento(p_agendamento_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_a record;
begin
  -- `for update of a` porque logo abaixo carimbamos: duas chamadas no
  -- mesmo instante serializam aqui, e só a primeira leva os aparelhos.
  select a.id, a.barbearia_id,
         coalesce(a.nome_atendido, cl.nome, a.cliente_nome) as nome_do_cliente,
         cl.telefone as telefone_do_cliente,
         a.data, a.horario, a.avisado_em, a.criado_em,
         s.nome as servico, b.nome as barbeiro, ba.nome as barbearia
  into v_a
  from public.agendamentos a
  join public.servicos s   on s.id = a.servico_id
  join public.barbearias ba on ba.id = a.barbearia_id
  left join public.barbeiros b on b.id = a.barbeiro_id
  left join public.clientes cl on cl.id = a.cliente_id
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
      'clienteNome',     v_a.nome_do_cliente,
      'clienteTelefone', coalesce(v_a.telefone_do_cliente, ''),
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

create or replace function public.clientes_do_dia_loja(p_slug text, p_data date)
returns jsonb
language plpgsql
stable
security definer
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
                 'clienteNome', coalesce(a.nome_atendido, cl.nome, a.cliente_nome)
               ) as linha
        from public.agendamentos a
        join public.servicos s on s.id = a.servico_id
        left join public.clientes cl on cl.id = a.cliente_id
        where a.barbearia_id = v_loja_id
          and a.data = p_data
          -- Cancelado e falta não compram nada: quem não veio não leva.
          and a.estado not in ('cancelado', 'faltou')
      ) as linhas
    ),
    '[]'::jsonb
  );
end $$;

-- O PostgREST passa a enxergar a tabela e as funções novas na hora.
notify pgrst, 'reload schema';

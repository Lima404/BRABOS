-- ============================================================
-- BARBOS — migração 0045: patch notes
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende da 0044. Pode rodar mais de uma vez.
--
-- Compatível com o código no ar: as colunas novas são anuláveis para os
-- alertas, a tabela nova ninguém lê ainda, e as duas funções que mudam de
-- formato (`meus_comunicados`, `admin_comunicados`) só GANHAM colunas.
--
-- ============================================================
-- A REGRA (Gabriel, 10/11/2026)
-- ============================================================
--
-- A notificação do tipo "atualização" vira um PATCH NOTE, no formato das
-- notas de versão do League of Legends:
--
--   - tem VERSÃO (1.0, 1.1, 1.2.3). A versão do sistema é a maior
--     publicada, e toda atualização nova precisa ser MAIOR que ela — o
--     gatilho `versao_nova_e_maior` recusa a menor ou igual. A primeira é
--     a 1.0. Compara por número, não por texto: 1.10 vem depois de 1.9, e
--     1.0 e 1.0.0 são a mesma versão (o índice único recusa a segunda);
--   - o título e o texto da notificação continuam: o texto é o RESUMO que
--     aparece no sino;
--   - o detalhe mora em SEÇÕES, uma por fluxo do sistema ("Agendamento",
--     "Dashboard", "Nova ferramenta"), cada uma com texto e até 6 fotos.
--
-- O alerta continua como era: título e texto, sem versão e sem seção.
--
-- As fotos ficam no Storage, bucket `patch-notes`, PRIVADO: print do
-- sistema pode mostrar nome e telefone de cliente da barbearia de teste,
-- e bucket público entregaria a foto a qualquer um com o endereço. Toda
-- conta logada lê (por endereço assinado, que vence); só o admin envia e
-- apaga.
-- ============================================================

-- ---------- versão ----------

-- "1.10" → {1,10,0}. Nulo para o que não é versão: o `check` abaixo é quem
-- recusa, com a mensagem certa.
create or replace function public.versao_em_numeros(p text)
returns integer[]
language sql
immutable
as $$
  select case
    when p ~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,2}$' then array[
      split_part(p, '.', 1)::integer,
      coalesce(nullif(split_part(p, '.', 2), ''), '0')::integer,
      coalesce(nullif(split_part(p, '.', 3), ''), '0')::integer
    ]
  end
$$;

alter table public.comunicados
  add column if not exists versao text;

alter table public.comunicados
  add column if not exists versao_num integer[]
  generated always as (public.versao_em_numeros(versao)) stored;

alter table public.comunicados drop constraint if exists comunicado_versao_formato;
alter table public.comunicados add constraint comunicado_versao_formato
  check (versao is null or versao ~ '^[0-9]{1,3}(\.[0-9]{1,3}){1,2}$');

-- Atualização TEM versão; alerta NÃO tem.
alter table public.comunicados drop constraint if exists comunicado_versao_so_na_atualizacao;
alter table public.comunicados add constraint comunicado_versao_so_na_atualizacao
  check ((tipo = 'atualizacao') = (versao is not null));

create unique index if not exists comunicados_uma_versao
  on public.comunicados (versao_num)
  where versao_num is not null;

-- Atualização nova precisa passar a maior publicada. Editar uma antiga não
-- passa por aqui (só o índice único vale): corrigir o número de uma versão
-- velha não é lançar uma nova.
--
-- Num BEFORE a coluna gerada ainda não foi calculada, por isso a conta é
-- feita com a função, não com `new.versao_num`.
create or replace function public.versao_nova_e_maior()
returns trigger
language plpgsql
as $$
declare
  v_atual text;
begin
  if new.tipo <> 'atualizacao' or new.versao is null then
    return new;
  end if;

  select c.versao into v_atual
  from public.comunicados c
  where c.versao_num is not null
  order by c.versao_num desc
  limit 1;

  if v_atual is not null
     and public.versao_em_numeros(new.versao) <= public.versao_em_numeros(v_atual) then
    raise exception 'versao precisa ser maior que %', v_atual
      using errcode = '22023', detail = v_atual;
  end if;
  return new;
end $$;

drop trigger if exists versao_nova_e_maior on public.comunicados;
create trigger versao_nova_e_maior
  before insert on public.comunicados
  for each row execute function public.versao_nova_e_maior();

-- ---------- seções ----------

-- Caminho de foto no bucket: `<uuid>.<png|jpg|webp>`, sorteado pela tela.
create or replace function public.fotos_validas(p text[])
returns boolean
language sql
immutable
as $$
  select coalesce(
    bool_and(f ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp)$'),
    true
  )
  from unnest(p) as f
$$;

create table if not exists public.comunicado_secoes (
  id             uuid primary key default gen_random_uuid(),
  comunicado_id  uuid not null references public.comunicados(id) on delete cascade,
  ordem          smallint not null check (ordem between 1 and 30),
  -- O fluxo do sistema: "Agendamento", "Dashboard", "Nova ferramenta".
  titulo         text not null check (char_length(btrim(titulo)) between 1 and 60),
  texto          text not null check (char_length(btrim(texto)) between 1 and 5000),
  -- Caminhos no bucket `patch-notes`, na ordem em que aparecem.
  fotos          text[] not null default '{}'
                   check (cardinality(fotos) <= 6 and public.fotos_validas(fotos)),
  unique (comunicado_id, ordem)
);

comment on table public.comunicado_secoes is
  'As seções de um patch note: uma por fluxo do sistema, com texto e fotos. Só a salvar_atualizacao escreve — 0045.';

alter table public.comunicado_secoes enable row level security;

drop policy if exists "toda barbearia le" on public.comunicado_secoes;
create policy "toda barbearia le" on public.comunicado_secoes
  for select to authenticated
  using (true);

-- Ninguém escreve direto: patch note e seções mudam JUNTOS, numa chamada
-- só (`salvar_atualizacao`). Escrita solta deixaria uma versão publicada
-- com metade das seções se a segunda chamada falhasse.
revoke all on public.comunicado_secoes from anon, authenticated;
grant select on public.comunicado_secoes to authenticated;

-- Publica (sem `p_id`) ou corrige (com `p_id`) um patch note inteiro:
-- versão, título, resumo e as seções, que são TROCADAS (apaga e grava na
-- ordem recebida). Tudo ou nada.
--
-- `p_secoes` = [{ "titulo": "...", "texto": "...", "fotos": ["<uuid>.png"] }]
create or replace function public.salvar_atualizacao(
  p_id      uuid,
  p_versao  text,
  p_titulo  text,
  p_texto   text,
  p_secoes  jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.sou_admin() then
    raise exception 'só a conta admin' using errcode = '42501';
  end if;
  if p_secoes is null
     or jsonb_typeof(p_secoes) <> 'array'
     or jsonb_array_length(p_secoes) not between 1 and 30 then
    raise exception 'o patch note precisa de 1 a 30 seções' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.comunicados (tipo, versao, titulo, texto)
    values ('atualizacao', btrim(p_versao), btrim(p_titulo), btrim(p_texto))
    returning id into v_id;
  else
    update public.comunicados
       set versao = btrim(p_versao), titulo = btrim(p_titulo), texto = btrim(p_texto)
     where id = p_id and tipo = 'atualizacao'
    returning id into v_id;
    if v_id is null then
      raise exception 'atualização não encontrada' using errcode = 'P0002';
    end if;
    delete from public.comunicado_secoes where comunicado_id = v_id;
  end if;

  insert into public.comunicado_secoes (comunicado_id, ordem, titulo, texto, fotos)
  select
    v_id,
    t.ordem,
    btrim(t.secao->>'titulo'),
    btrim(t.secao->>'texto'),
    coalesce(
      (select array_agg(f.caminho order by f.n)
         from jsonb_array_elements_text(coalesce(t.secao->'fotos', '[]'::jsonb))
              with ordinality as f(caminho, n)),
      '{}'
    )
  from jsonb_array_elements(p_secoes) with ordinality as t(secao, ordem);

  return v_id;
end $$;

-- ---------- as listas ganham a versão ----------
-- Mudar o formato de devolução exige apagar e criar de novo.

drop function if exists public.meus_comunicados();
create function public.meus_comunicados()
returns table (
  id             uuid,
  tipo           text,
  versao         text,
  titulo         text,
  texto          text,
  publicado_em   timestamptz,
  atualizado_em  timestamptz,
  nova           boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.tipo,
    c.versao,
    c.titulo,
    c.texto,
    c.publicado_em,
    c.atualizado_em,
    not public.sou_admin()
      and c.publicado_em >= coalesce(
        (select b.criada_em from public.barbearias b where b.id = auth.uid()),
        'infinity'::timestamptz
      )
      and not exists (
        select 1 from public.comunicados_lidos l
        where l.comunicado_id = c.id and l.barbearia_id = auth.uid()
      )
  from public.comunicados c
  order by c.publicado_em desc
  limit 200
$$;

drop function if exists public.admin_comunicados();
create function public.admin_comunicados()
returns table (
  id             uuid,
  tipo           text,
  versao         text,
  titulo         text,
  texto          text,
  publicado_em   timestamptz,
  atualizado_em  timestamptz,
  lidos          integer,
  publico        integer,
  secoes         jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
#variable_conflict use_column
begin
  if not public.sou_admin() then
    raise exception 'só a conta admin' using errcode = '42501';
  end if;

  return query
  select
    c.id,
    c.tipo,
    c.versao,
    c.titulo,
    c.texto,
    c.publicado_em,
    c.atualizado_em,
    (select count(*)
       from public.comunicados_lidos l
       join public.barbearias b on b.id = l.barbearia_id
      where l.comunicado_id = c.id
        and not b.admin
        and b.criada_em <= c.publicado_em)::integer,
    (select count(*)
       from public.barbearias b
      where not b.admin
        and b.criada_em <= c.publicado_em)::integer,
    coalesce(
      (select jsonb_agg(
                jsonb_build_object('titulo', s.titulo, 'texto', s.texto, 'fotos', to_jsonb(s.fotos))
                order by s.ordem)
         from public.comunicado_secoes s
        where s.comunicado_id = c.id),
      '[]'::jsonb
    )
  from public.comunicados c
  order by c.publicado_em desc;
end $$;

-- ---------- as fotos: bucket privado ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('patch-notes', 'patch-notes', false, 5242880,
        array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "patch notes: conta logada ve" on storage.objects;
create policy "patch notes: conta logada ve" on storage.objects
  for select to authenticated
  using (bucket_id = 'patch-notes');

drop policy if exists "patch notes: so o admin envia" on storage.objects;
create policy "patch notes: so o admin envia" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'patch-notes' and public.sou_admin());

drop policy if exists "patch notes: so o admin apaga" on storage.objects;
create policy "patch notes: so o admin apaga" on storage.objects
  for delete to authenticated
  using (bucket_id = 'patch-notes' and public.sou_admin());

-- ---------- quem pode chamar o quê ----------
-- `versao_em_numeros` e `fotos_validas` ficam abertas: são contas puras de
-- texto, e a coluna gerada e o `check` as chamam com o papel de quem grava.
revoke execute on function
  public.versao_nova_e_maior(),
  public.salvar_atualizacao(uuid, text, text, text, jsonb),
  public.meus_comunicados(),
  public.admin_comunicados()
from public, anon;

revoke execute on function public.versao_nova_e_maior() from authenticated;

grant execute on function
  public.salvar_atualizacao(uuid, text, text, text, jsonb),
  public.meus_comunicados(),
  public.admin_comunicados()
to authenticated;

notify pgrst, 'reload schema';

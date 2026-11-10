-- ============================================================
-- BARBOS — migração 0046: link nas seções do patch note
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende da 0045. Pode rodar mais de uma vez.
--
-- Compatível com o código no ar: as duas colunas são anuláveis, a
-- `salvar_atualizacao` antiga não manda link (fica nulo), e a
-- `admin_comunicados` só GANHA duas chaves dentro do jsonb das seções.
--
-- ============================================================
-- A REGRA (Gabriel, 10/11/2026)
-- ============================================================
--
-- Cada seção do patch note pode levar UM link, que vira um botão na
-- página /patch-notes. A barbearia clica e vai para o endereço.
--
--   - `link`: endereço http(s) completo, ou um caminho do próprio
--     sistema ("/dashboard", "/agenda"). Nada de `javascript:`, `data:`
--     ou "//outro-site" (que o navegador lê como outro domínio) — o
--     `check` recusa, porque o endereço vai parar num `href` na tela de
--     toda barbearia;
--   - `link_rotulo`: o texto do botão ("Ver o vídeo", "Abrir a agenda").
--     Opcional: sem ele a tela escreve "Abrir link". Só existe com link.
-- ============================================================

alter table public.comunicado_secoes
  add column if not exists link text,
  add column if not exists link_rotulo text;

-- O caminho interno não pode começar por "//" nem por "/\": os dois o
-- navegador trata como endereço de OUTRO site.
alter table public.comunicado_secoes drop constraint if exists secao_link_valido;
alter table public.comunicado_secoes add constraint secao_link_valido
  check (
    link is null
    or (
      char_length(link) <= 2000
      and link ~ '^(https?://[^[:space:]]+|/([^/\\[:space:]][^[:space:]]*)?)$'
    )
  );

alter table public.comunicado_secoes drop constraint if exists secao_link_rotulo;
alter table public.comunicado_secoes add constraint secao_link_rotulo
  check (
    link_rotulo is null
    or (link is not null and char_length(btrim(link_rotulo)) between 1 and 40)
  );

-- `p_secoes` = [{ "titulo": "...", "texto": "...", "fotos": [...],
--                 "link": "https://..." | null, "link_rotulo": "..." | null }]
-- O resto é igual à 0045.
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

  insert into public.comunicado_secoes
    (comunicado_id, ordem, titulo, texto, fotos, link, link_rotulo)
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
    ),
    nullif(btrim(t.secao->>'link'), ''),
    -- Rótulo sem link não existe: cai junto.
    case
      when nullif(btrim(t.secao->>'link'), '') is not null
        then nullif(btrim(t.secao->>'link_rotulo'), '')
    end
  from jsonb_array_elements(p_secoes) with ordinality as t(secao, ordem);

  return v_id;
end $$;

-- Mesmo formato de devolução da 0045 (por isso `create or replace` basta):
-- só o jsonb de cada seção ganha `link` e `link_rotulo`.
create or replace function public.admin_comunicados()
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
                jsonb_build_object(
                  'titulo', s.titulo,
                  'texto', s.texto,
                  'fotos', to_jsonb(s.fotos),
                  'link', s.link,
                  'link_rotulo', s.link_rotulo)
                order by s.ordem)
         from public.comunicado_secoes s
        where s.comunicado_id = c.id),
      '[]'::jsonb
    )
  from public.comunicados c
  order by c.publicado_em desc;
end $$;

-- `create or replace` mantém as permissões; repetidas aqui para a
-- migração valer sozinha num banco recriado.
revoke execute on function
  public.salvar_atualizacao(uuid, text, text, text, jsonb),
  public.admin_comunicados()
from public, anon;

grant execute on function
  public.salvar_atualizacao(uuid, text, text, text, jsonb),
  public.admin_comunicados()
to authenticated;

notify pgrst, 'reload schema';

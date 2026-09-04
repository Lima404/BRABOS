-- ============================================================
-- BARBOS — migração 0005: a loja (endereço público + vitrine)
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0001 (contas) e 0004 (produtos). Pode rodar mais de uma vez.
--
-- Numerada 0005 e não 0004: `0004_produtos.sql` já ocupava esse número.
--
-- A loja é aberta: quem lê o QR code na parede da barbearia não tem conta,
-- não tem sessão, e portanto o sistema não tem como saber de qual barbearia
-- se trata. Quem carrega essa informação é a URL — e é por isso que a
-- barbearia precisa de um apelido público (`slug`).
-- ============================================================

alter table public.barbearias
  add column if not exists slug text,
  -- Interruptor da vitrine. Barbearia que não quer vender fecha a loja sem
  -- perder o endereço — o QR code impresso continua valendo quando reabrir.
  add column if not exists loja_ativa boolean not null default true;

-- ---------- apelido a partir do nome ----------
-- Sem a extensão `unaccent`: ela não vem ligada em todo projeto Supabase, e
-- um `translate` resolve o alfabeto português inteiro.
create or replace function public.gerar_slug(texto text)
returns text
language sql
immutable
as $$
  select nullif(
    trim(both '-' from regexp_replace(
      lower(translate(
        coalesce(texto, ''),
        'àáâãäåèéêëìíîïòóôõöùúûüçñÀÁÂÃÄÅÈÉÊËÌÍÎÏÒÓÔÕÖÙÚÛÜÇÑ',
        'aaaaaaeeeeiiiiooooouuuucnaaaaaaeeeeiiiiooooouuuucn'
      )),
      '[^a-z0-9]+', '-', 'g'
    )),
    ''
  )
$$;

comment on function public.gerar_slug is
  'Texto livre em apelido de URL. Sem acento, sem espaço, sem maiúscula.';

/*
 * Apelido livre para uma barbearia.
 *
 * Tenta o apelido limpo; se já estiver tomado, cola um pedaço do id no fim.
 * O id é único, então isto nunca entra em laço nem depende de sorte.
 */
create or replace function public.slug_livre(nome text, id uuid)
returns text
language plpgsql
stable
as $$
declare
  base text := coalesce(public.gerar_slug(nome), 'barbearia');
begin
  if not exists (
    select 1 from public.barbearias b
    where b.slug = base and b.id <> slug_livre.id
  ) then
    return base;
  end if;

  return base || '-' || left(replace(id::text, '-', ''), 6);
end $$;

-- ---------- quem já existia ganha apelido ----------
--
-- CUIDADO com o jeito óbvio (`set slug = slug_livre(nome, id)`): dentro de um
-- único UPDATE a função enxerga o banco como estava ANTES do comando, então
-- duas barbearias chamadas "Minha barbearia" — o padrão de toda conta nova —
-- receberiam o mesmo apelido e o índice único abaixo falharia.
--
-- Por isso a numeração: dentro de cada nome repetido, só a primeira fica com
-- o apelido limpo; as outras levam um pedaço do id no fim.
with numeradas as (
  select
    b.id,
    coalesce(public.gerar_slug(b.nome), 'barbearia') as base,
    row_number() over (
      partition by coalesce(public.gerar_slug(b.nome), 'barbearia')
      order by b.criada_em, b.id
    ) as posicao
  from public.barbearias b
  where b.slug is null
)
update public.barbearias b
set slug = case
  when n.posicao = 1
   and not exists (select 1 from public.barbearias o where o.slug = n.base)
  then n.base
  else n.base || '-' || left(replace(b.id::text, '-', ''), 6)
end
from numeradas n
where b.id = n.id;

-- O apelido é o endereço público. Precisa ser único e não pode faltar.
create unique index if not exists barbearias_slug_unico on public.barbearias (slug);

alter table public.barbearias alter column slug set not null;

comment on column public.barbearias.slug is
  'Apelido público da loja (/loja/<slug>). NÃO muda quando o nome muda: o QR code impresso aponta pra cá.';

-- ============================================================
-- A vitrine pública
--
-- `barbearias` continua fechada por RLS (cada dona vê só a si mesma). Esta
-- view é a ÚNICA porta aberta, e mostra só o que uma vitrine precisa: o
-- apelido e o nome. Telefone, id de dono e datas não passam por aqui.
--
-- View comum (sem `security_invoker`) roda com os privilégios de quem a
-- criou, então o RLS da tabela por baixo não se aplica — é exatamente o que
-- queremos, e por isso a lista de colunas acima é curta de propósito.
-- ============================================================

drop view if exists public.lojas;

create view public.lojas
with (security_invoker = false)
as
select
  b.id,
  b.slug,
  b.nome
from public.barbearias b
where b.loja_ativa;

comment on view public.lojas is
  'Vitrine pública das barbearias. Única leitura de barbearias sem sessão.';

grant select on public.lojas to anon, authenticated;

-- ============================================================
-- A vitrine de produtos
--
-- A view é só o GET público (sem sessão). Mercearia e salão passam;
-- quem decide o que aparece na loja é o app: unidades >= 1 e preço > 0.
-- `unidades` e `tipo` vêm na leitura do servidor, mas a UI não mostra
-- quantidade — só nome e preço.
-- ============================================================

drop view if exists public.loja_produtos;

create view public.loja_produtos
with (security_invoker = false)
as
select
  p.id,
  p.barbearia_id,
  p.nome,
  p.preco_centavos,
  p.unidades,
  p.tipo
from public.produtos p
join public.barbearias b on b.id = p.barbearia_id
where b.loja_ativa
  and p.tipo in ('mercearia', 'salao');

comment on view public.loja_produtos is
  'GET público da loja: mercearia e salão. Filtro de vitrine fica no app.';

grant select on public.loja_produtos to anon, authenticated;

-- ============================================================
-- Conta nova já nasce com apelido
-- ============================================================

create or replace function public.ao_criar_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nome_barbearia text := coalesce(
    nullif(trim(new.raw_user_meta_data->>'barbearia'), ''),
    'Minha barbearia'
  );
begin
  -- Duas contas criadas no mesmo instante com o mesmo nome disputariam o
  -- apelido limpo, e a segunda quebraria o cadastro inteiro no índice único.
  -- O `exception` transforma essa corrida em apelido com sufixo.
  begin
    insert into public.barbearias (id, nome, slug)
    values (new.id, nome_barbearia, public.slug_livre(nome_barbearia, new.id))
    on conflict (id) do nothing;
  exception
    when unique_violation then
      insert into public.barbearias (id, nome, slug)
      values (
        new.id,
        nome_barbearia,
        coalesce(public.gerar_slug(nome_barbearia), 'barbearia')
          || '-' || left(replace(new.id::text, '-', ''), 6)
      )
      on conflict (id) do nothing;
  end;

  insert into public.configuracao_agenda (barbearia_id)
  values (new.id)
  on conflict (barbearia_id) do nothing;

  insert into public.servicos (barbearia_id, nome, preco_centavos, duracao_min, cor, ordem)
  select new.id, p.nome, p.preco, p.duracao, p.cor, p.ordem
  from (values
    ('Cabelo',         4500, 30::smallint, 'azul',    1::smallint),
    ('Barba',          3000, 20::smallint, 'verde',   2::smallint),
    ('Cabelo + Barba', 7000, 50::smallint, 'violeta', 3::smallint)
  ) as p(nome, preco, duracao, cor, ordem)
  where not exists (
    select 1 from public.servicos s where s.barbearia_id = new.id
  );

  return new;
end $$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.ao_criar_usuario();

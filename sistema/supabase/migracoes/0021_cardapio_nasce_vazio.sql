-- ============================================================
-- BARBOS — migração 0021: barbearia nova nasce SEM cardápio
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0005. Pode rodar mais de uma vez.
--
-- Até aqui toda conta nova ganhava Cabelo, Barba e Cabelo + Barba,
-- com preço e duração inventados por nós. Isso veio da 0003, quando os
-- serviços saíram de um enum fixo no código e precisavam continuar
-- aparecendo pra quem já usava o sistema — era migração de dado, não
-- decisão de produto.
--
-- Pedido do Gabriel: cardápio vazio. O preço de um corte é a coisa
-- mais particular de cada barbearia, e R$ 45,00 chutado por nós ou
-- vira o preço errado no primeiro agendamento, ou vira mais um item
-- pra apagar antes de começar.
--
-- O QUE CONTINUA sendo criado, e por quê:
--   - a linha em `barbearias`, com o apelido público (slug);
--   - a linha em `configuracao_agenda`, com o horário padrão.
-- Sem a configuração o calendário não sabe quando a loja abre e a tela
-- abre torta. Horário padrão é palpite corrigível; preço não é.
--
-- Não mexe em barbearia que já existe: quem já tem os três serviços
-- continua com eles.
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

  -- Aqui morava a semeadura de Cabelo / Barba / Cabelo + Barba.
  -- Saiu de propósito — ver o cabeçalho. Se algum dia voltar, que volte
  -- como uma ESCOLHA na tela de cadastro ("começar com um cardápio de
  -- exemplo?"), nunca como fato consumado no gatilho.

  return new;
end $$;

comment on function public.ao_criar_usuario() is
  'Conta nova ganha barbearia (com slug) e configuração de agenda. Cardápio nasce vazio — 0021.';

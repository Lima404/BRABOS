-- ============================================================
-- BARBOS — migração 0034: nome do convite
--
-- Rodar em: Supabase → SQL Editor → New query → colar → Run.
-- Depende de 0033. Pode rodar mais de uma vez.
--
-- Um nome que a dona escolhe: "PROMO OUTUBRO", "SABADO 5 VAGAS". Sem
-- ele a lista é um punhado de códigos de oito letras sorteadas, todos
-- parecidos entre si, e lembrar qual foi mandado para quem vira
-- adivinhação — justamente quando ela precisa desligar UM deles.
--
-- Opcional de propósito. Quem gera um link às pressas no balcão não vai
-- parar para batizá-lo, e exigir nome transformaria "gerar link" em
-- formulário.
--
-- ADITIVA, como a 0033: coluna nova numa tabela que a produção não lê.
-- Nenhuma função existente muda.
-- ============================================================

alter table public.convites_agendamento
  add column if not exists apelido text;

alter table public.convites_agendamento
  drop constraint if exists apelido_do_convite_valido;

-- Vazio não existe: ou tem nome, ou é null. Com string vazia permitida, a
-- tela precisaria testar as duas coisas em todo lugar que mostra o nome —
-- e esqueceria numa delas.
alter table public.convites_agendamento
  add constraint apelido_do_convite_valido check (
    apelido is null
    or (length(btrim(apelido)) between 1 and 40
        and apelido = btrim(apelido))
  );

comment on column public.convites_agendamento.apelido is
  'Nome que a dona deu ao link ("PROMO OUTUBRO"). Null quando nao batizou.';

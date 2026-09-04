-- ============================================================
-- BARBOS — dados de exemplo (OPCIONAL)
--
-- Roda DEPOIS de 0001 e DEPOIS de criar seu usuario.
-- Serve so pra ver a agenda com conteudo. Apague quando entrar dado real.
--
-- >>> TROQUE O E-MAIL ABAIXO PELO SEU <<<
-- ============================================================

do $$
declare
  minha_barbearia_id uuid;
  cliente_rafael uuid;
  cliente_ana    uuid;
  agend          uuid;
  hoje           date := current_date;
begin
  -- ↓↓↓ TROQUE AQUI ↓↓↓
  select p.barbearia_id into minha_barbearia_id
  from public.perfis p
  join auth.users u on u.id = p.id
  where u.email = 'troque@pelo-seu-email.com';
  -- ↑↑↑ TROQUE AQUI ↑↑↑

  if minha_barbearia_id is null then
    raise exception 'Usuário não encontrado. Crie o usuário em Authentication → Users e troque o e-mail neste script.';
  end if;

  -- Servicos
  insert into public.servicos (barbearia_id, nome, preco_centavos, duracao_min)
  values
    (minha_barbearia_id, 'Corte',            4500, 30),
    (minha_barbearia_id, 'Barba',            3000, 20),
    (minha_barbearia_id, 'Corte na máquina', 4000, 20),
    (minha_barbearia_id, 'Pigmentação',      6000, 40)
  on conflict do nothing;

  -- Produtos (estoque)
  insert into public.produtos (barbearia_id, nome, quantidade, quantidade_min, preco_centavos)
  values
    (minha_barbearia_id, 'Pomada modeladora', 12, 5, 3500),
    (minha_barbearia_id, 'Óleo para barba',    3, 5, 4200),
    (minha_barbearia_id, 'Lâmina descartável', 0, 20, 200)
  on conflict do nothing;

  -- Clientes
  insert into public.clientes (barbearia_id, nome, telefone)
  values (minha_barbearia_id, 'Rafael Nunes', '11 99640-2277')
  returning id into cliente_rafael;

  insert into public.clientes (barbearia_id, nome, telefone)
  values (minha_barbearia_id, 'Ana Prado', '11 97731-8890')
  returning id into cliente_ana;

  -- Agendamento em atendimento
  insert into public.agendamentos (barbearia_id, cliente_id, inicio, duracao_min, estado)
  values (minha_barbearia_id, cliente_rafael, hoje + time '09:30', 50, 'atendendo')
  returning id into agend;

  insert into public.agendamento_servicos (agendamento_id, nome, preco_centavos)
  values (agend, 'Corte', 4500), (agend, 'Barba', 3000);

  -- Agendamento futuro, com observacao
  insert into public.agendamentos (barbearia_id, cliente_id, inicio, duracao_min, estado, observacao)
  values (minha_barbearia_id, cliente_ana, hoje + time '11:00', 30, 'agendado',
          'Primeira vez. Indicação do Rafael.')
  returning id into agend;

  insert into public.agendamento_servicos (agendamento_id, nome, preco_centavos)
  values (agend, 'Corte', 4500);

  -- Cliente sem cadastro que nao apareceu
  insert into public.agendamentos (barbearia_id, cliente_nome, inicio, duracao_min, estado)
  values (minha_barbearia_id, 'Cliente sem cadastro', hoje + time '11:45', 20, 'faltou')
  returning id into agend;

  insert into public.agendamento_servicos (agendamento_id, nome, preco_centavos)
  values (agend, 'Barba', 3000);

  raise notice 'Dados de exemplo inseridos na barbearia %', minha_barbearia_id;
end $$;

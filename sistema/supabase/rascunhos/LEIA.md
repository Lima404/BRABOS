# Rascunhos — NÃO estão aplicados

Esquema pensado para as próximas telas (clientes, serviços, produtos,
agendamentos). **Nada aqui foi rodado no banco.**

A decisão de escopo foi começar só pela conta: `migracoes/0001_barbearias.sql`.

Quando cada tela chegar, o rascunho correspondente vira uma migração numerada
em `migracoes/` — com dois ajustes obrigatórios, porque o modelo mudou:

1. Não existe mais a tabela `perfis`. `barbearias.id` **é** o `auth.users.id`.
2. Some a função `minha_barbearia()`. Nas políticas de RLS, a comparação passa
   a ser direta: `barbearia_id = auth.uid()`.

Falta também a tabela `barbeiros` (equipe da barbearia), que não existia no
rascunho: os barbeiros são linhas dentro da barbearia e compartilham o login
dela — não são usuários do Supabase Auth.

# Manutenção — scripts que se roda à mão

Não são migrações. Não têm número, não entram na ordem, e **nada aqui roda
sozinho**. São operações pontuais que você cola no SQL Editor do Supabase
quando precisa.

Migração muda o **esquema** e todo banco tem que receber. Script de manutenção
mexe em **dado** de um banco específico. Misturar os dois faria a limpeza de
uma conta de teste virar parte do histórico do produto.

## `apagar-barbearia.sql`

Apaga uma barbearia inteira — dado e conta de login.

**Por que não dá pra sair deletando a linha:** três chaves estrangeiras
`on delete restrict` travam o cascata no meio do caminho —
`itens_venda.produto_id → produtos`, `agendamentos.servico_id → servicos` e
`agendamentos.barbeiro_id → barbeiros`.

Elas estão certas: existem pra que apagar um serviço ou um produto nunca leve
junto o histórico de quem foi atendido. **Não troque por `cascade`** para
resolver a limpeza — seria abrir um buraco permanente no app pra economizar um
script que roda uma vez por ano. O script apaga na ordem certa.

Ele termina em `delete from auth.users`, e não só na tabela `barbearias`. Sem
isso o usuário fica órfão no Auth com o e-mail preso para sempre — que é
exatamente como as `@mailinator.com` sobraram.

Aceita várias de uma vez: os ids vão num array, e o bloco é tudo ou nada.

**A trava é por apelido, não por nome.** O script recusa a lista inteira se
ela incluir a barbearia de `slug` `bicos` — é onde tudo é testado (ver
`AGENTS.md`), e recriar cardápio, equipe e estoque à mão custa uma tarde. Nome
não serve de trava: já houve DUAS barbearias chamadas "Gabriel Teste" ao mesmo
tempo, e a órfã era justamente uma delas.

## `apagar-servicos.sql`

Apaga o cardápio de UMA barbearia. Como `agendamentos.servico_id → servicos` é
`on delete restrict`, isso leva junto **toda a agenda** dela — não existe
meio-termo para serviço que já foi agendado. As vendas da loja sobrevivem:
`vendas.agendamento_id` é `on delete set null`, então a venda perde o vínculo
mas continua no caixa.

O arquivo traz também a alternativa que **não** perde histórico: `ativo =
false`, que é o que o próprio app faz no botão "Desativar serviço".

## `limpar-banco.sql`

Zera o banco inteiro — todas as barbearias, todos os dados, todas as contas de
login. O **esquema fica**: tabelas, funções, gatilhos, RLS e views continuam
de pé, e nenhuma migração precisa ser rodada de novo.

Esvazia tudo num `truncate` de lista única — com todas as tabelas na mesma
lista, a ordem deixa de importar e os três `on delete restrict` não travam. Só
depois apaga `auth.users`, que é o inverso do que o painel tenta fazer.

**Tem uma trava:** a variável `v_confirmo` nasce `false` e o bloco recusa
rodar. É preciso trocar para `true` com a mão. Um Ctrl+A / Run distraído no
SQL Editor apagaria o banco em silêncio, e não tem lixeira.

Depois de rodar você fica deslogado e precisa cadastrar de novo em
`/cadastrar`. Recriando com o mesmo e-mail e senha, o `.env.local` volta a
valer sozinho.

## `povoar-outubro-2026.sql`

Enche outubro de 2026 da barbearia **BARBOS** (slug `bicos`) com 230
agendamentos concluídos — 6 a 12 por dia, nos 27 dias de atendimento do mês.
Para ver a agenda e o dashboard cheios sem depender de movimento real.

Concluídos porque outubro já passou: um 'agendado' num mês vencido não entra
no dashboard e fica estranho na agenda.

**Ele respeita o que a barbearia tem configurado**, lido do banco antes de
gerar: segunda a sábado, por turno (09:00–12:00 e 14:00–21:00), passo de 30
minutos, os 5 serviços ativos com duração e preço de cada um, e só os 3
barbeiros ativos. Nenhum atendimento atravessa o almoço ou o fechamento, e
nenhum barbeiro atende dois ao mesmo tempo — a trava
`agendamento_sem_sobreposicao` recusaria. Os 11 agendamentos que outubro já
tinha entraram no cálculo para não colidir.

**Desfazer é uma linha.** Todo id começa com `0ad5eed0` ("seed" em
hexadecimal):

```sql
delete from public.agendamentos where id::text like '0ad5eed0-%';
```

A marca está no ID e não na observação de propósito: observação aparece no
cartão da agenda, e escrever "demonstração" em duzentos cartões estragaria
justamente o que o script existe para mostrar.

O script começa apagando o que ele mesmo inseriu, então rodar duas vezes não
duplica.

**Os telefones são da faixa 90000-xxxx**, que não é atribuída a celular no
Brasil. Passam no CHECK de DDD e o botão de WhatsApp não cai no número de
ninguém.

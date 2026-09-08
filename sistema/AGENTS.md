<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
---

# BARBOS — sistema

Sistema de gestão para barbearias. Agenda, serviços, estoque.

**O concorrente é o caderno de papel, não outro software.** O usuário é dono de
barbearia saindo do papel — ele já sabe o que quer ver. Simplicidade e
velocidade valem mais que quantidade de recurso.

## Antes de escrever qualquer coisa visual

Ler `../identidade/design-guide.md`. É a fonte da verdade da marca, e os
contrastes lá foram medidos, não estimados.

## Regras não negociáveis

- **Nenhum hex solto.** Toda cor vem de `app/globals.css` (tokens semânticos:
  `bg-card`, `text-muted-foreground`, `bg-agendado-fundo`…). Hex dentro de
  componente é erro de revisão.
- **Alvo de toque mínimo 44px, ideal 48.** Os tamanhos do `Button` e do `Input`
  do shadcn foram alterados por isso — `size="sm"` e menores existem só pra
  área de mouse, nunca em fluxo tocado durante o atendimento.
- **Texto nunca abaixo de 16px em campo ou conteúdo tocado.** 14px só em apoio,
  12px é o piso absoluto e nunca em informação crítica.
- **Um botão âmbar (`variant="default"`) por tela.** Se tudo é âmbar, nada é ação.
- **Estado nunca só por cor.** Todo badge de estado carrega texto; os que geram
  prejuízo (não compareceu, cancelado) carregam ícone ou tachado também.
- **Tema escuro no mesmo commit que o claro.** Não é enfeite: é a barbearia às
  nove da noite com a tela no balcão.
- **Toda tela precisa de três estados:** carregando, erro e vazio. Nenhum deles
  pode ser beco sem saída — estado vazio sempre com a ação de saída.
- **Nada de controle solto.** Todo campo, escolha, recado e estado vazio sai
  de `components/ui/`. Ver o amostruário em **`/componentes`** — ele mostra as
  peças e diz quando usar cada uma. Peça nova entra lá no mesmo commit.
- **`Alerta` fica na página; `Toast` aparece e some.** O que a pessoa precisa
  reler vai pro `Alerta`; o que confirma ou recusa uma ação que ela acabou de
  fazer vai pro `Toast` (`useToast().avisar(...)`). Os quatro tons vêm de
  `components/ui/tons.ts` — um mapa só, para "erro" não ter dois ícones.
- **Modal é sempre o `Modal` de `components/ui/modal.tsx`.** Nunca montar um
  `DialogContent` na mão: largura, rolagem, rodapé fixo e comportamento no
  celular são decididos lá, uma vez só. `dialog.tsx` é o primitivo e só o
  `Modal` fala com ele. Tamanhos: `pequeno` (confirmação), `medio` (padrão),
  `grande` (formulário com seções), `cheio` (lista longa). Fluxo de mais de um
  passo usa `aoVoltar` e TROCA o conteúdo — modal por cima de modal, nunca.
- **Ação principal na metade inferior no celular.** A mão que segura o telefone
  alcança o rodapé, não o topo. Ver a barra fixa em `app/agenda/page.tsx`.
- **Dinheiro em centavos (inteiro), nunca float.** Formatação só em `lib/formato.ts`.
- **Horário, preço e quantidade com `tabular-nums`** — já aplicado a `<time>`,
  `[data-numero]` e `td` no `globals.css`.

## Arquitetura

```
app/
  layout.tsx              shell: fontes, faixa, cabeçalho, providers
  providers.tsx           React Query + next-themes (client)
  page.tsx                redireciona pra /agenda
  agenda/page.tsx         server component: prefetch + HydrationBoundary
  api/agendamentos/       rota HTTP
components/
  ui/                     as pecas da interface (amostruario em /componentes)
    button, input, textarea, select, checkbox, radio, switch, badge
    campo.tsx             Campo (rotulo+ajuda+erro) e Opcao (linha de escolha)
    modal.tsx             o modal padrao — todo modal passa por ele
    dialog.tsx            primitivo do modal; so o modal.tsx fala com ele
    alerta.tsx            recado na pagina: erro, aviso, info, sucesso
    toast.tsx             recado flutuante (Radix Toast) + useToast()
    tons.ts               os 4 tons: icone e cor, num lugar so
    estado-vazio.tsx      "nao tem nada aqui ainda", sempre com saida
  agenda/                 componentes da agenda
  marca/logo.tsx          lockup, troca por tema
lib/
  tipos.ts                domínio + metadados de estado (ESTADOS)
  repositorio.ts          dados (server-only) — trocar por banco aqui, só aqui
  api.ts                  chamadas do navegador
  query.ts                QueryClient + chaves de cache
  formato.ts              moeda, hora, data em pt-BR
```

**Fluxo de dados:** o server component faz `prefetchQuery` chamando
`lib/repositorio` direto (sem HTTP), e entrega via `HydrationBoundary`. O
client component usa `useQuery` com a mesma chave e reidrata sem refetch. Quando
entrar banco de verdade, só `lib/repositorio.ts` muda.

**Chaves de cache** ficam em `lib/query.ts`. Nunca escrever `queryKey` literal
espalhado pelas telas.

## Ordem de construção

Agenda de hoje → novo agendamento → cliente → serviços → estoque → relatório.
A agenda primeiro porque é a única tela aberta todo dia.

## Testar: sempre na barbearia "Gabriel Teste"

**Nunca criar conta pra testar.** Já sobraram várias `@mailinator.com` órfãs
assim — e uma delas chegou a virar uma SEGUNDA barbearia chamada "Gabriel
Teste", disputando o apelido público da verdadeira.

Correção do que este arquivo dizia antes: apagar conta **não** é impossível
nem exige a chave `service_role`. O SQL Editor do Supabase roda como
`postgres` e alcança `auth.users`. O que atrapalha é outra coisa — três chaves
`on delete restrict` (`itens_venda → produtos`, `agendamentos → servicos`,
`agendamentos → barbeiros`) travam o cascata no meio, então a limpeza tem que
ser feita na ordem certa. O roteiro está em
`supabase/manutencao/apagar-barbearia.sql`.

A regra continua de pé pelo motivo verdadeiro: é cirurgia manual num banco de
produção, com id colado à mão e sem desfazer. Não é o preço de "só queria
testar uma coisinha".

As credenciais moram em `.env.local` (fora do git), em `BARBOS_EMAIL_TESTE` e
`BARBOS_SENHA_TESTE`. Antes de testar:

```
npm run teste:conta
```

Ele entra, confere que a barbearia se chama "Gabriel Teste" e **recusa seguir**
se não for. Se as variáveis estiverem vazias, ele diz o que preencher — peça
ao dono que preencha o arquivo, nunca a senha no chat.

## Comandos

```
npm run dev        desenvolvimento
npm run build      build de produção (roda o TypeScript)
npm run lint       eslint
npm run typecheck  tsc --noEmit (precisa de um build antes, pelos tipos gerados)
npm run teste:conta      confere a conta de teste ("Gabriel Teste")
npm run supabase:verificar  quais migracoes ainda faltam
```

## Autenticação e dados (Supabase)

Login por **e-mail + senha**. **Uma conta de login = uma barbearia.**

`barbearias.id` **é** o `auth.users.id` — não existe tabela de perfil no meio.
Por isso toda política de RLS compara direto: `id = auth.uid()`.

Os barbeiros da equipe virão como **linhas dentro da barbearia**, não como
usuários do Supabase Auth: eles entram com o e-mail e a senha da barbearia
(login compartilhado). Consequência a tratar quando essa tela chegar: o
sistema não sabe sozinho qual barbeiro agiu — vai precisar de um seletor de
"quem está atendendo" depois do login, e a senha tem que ser trocada quando
alguém sai da equipe.

```
proxy.ts                    renova sessão e barra rota privada
lib/supabase/config.ts      leitura das env vars, em um lugar só
lib/supabase/cliente.ts     cliente do navegador
lib/supabase/servidor.ts    cliente do servidor (por requisição — nunca em módulo)
lib/conta.ts                a barbearia da sessão
app/(sistema)/agenda/acoes.ts  escrita de configuracao e de servicos
app/entrar/                 login + server actions (entrar, sair)
app/cadastrar/              criação de conta com confirmação por e-mail
app/auth/confirmar/         callback do link de confirmação
supabase/migracoes/         SQL versionado
supabase/modelos-email/     modelo de e-mail recomendado (ver LEIA.md)
```

**Confirmação de e-mail — os dois formatos de link.** O callback aceita
`token_hash` (funciona em qualquer aparelho) e `code` (PKCE, só no mesmo
navegador). Tratar os dois evita o caso de suporte mais comum: cadastro no
computador, e-mail aberto no celular. Nunca remover um dos dois ramos.

**Cadastro não revela quem já tem conta.** Com confirmação de e-mail ligada, o
Supabase devolve sucesso com `identities` vazio para e-mail já cadastrado — de
propósito. A tela responde igual nos dois casos. Não "melhorar" isso mostrando
"e-mail já existe": vira enumeração de usuários.

### Laço de redirecionamento — as duas causas que já aconteceram

O `proxy.ts` já produziu `ERR_TOO_MANY_REDIRECTS` duas vezes. As defesas estão
marcadas no arquivo com `// LAÇO:`. **Nenhuma das duas pode ser removida.**

1. **Falha de transporte não é "deslogado".** A interceptação de HTTPS por
   antivírus é intermitente: uma chamada falha, a próxima passa. Tratar a falha
   como sessão ausente produz `/agenda → /entrar → /agenda → …`. Quando o
   `getUser()` *lança*, o proxy deixa passar sem redirecionar — não vaza nada,
   porque quem isola é o RLS, e sem sessão a página abre vazia.

2. **Redirecionamento precisa herdar os cookies renovados.** O `getUser()` gira
   o token, e o token antigo morre na hora. Os cookies novos são escritos na
   resposta do `NextResponse.next()`; um `NextResponse.redirect()` novo os joga
   fora, o navegador fica com o token morto e é barrado de novo:
   `/entrar → /agenda → /entrar → …`. Todo redirecionamento passa por
   `herdarCookies()`.

Além disso: cookie de sessão presente + usuário ausente = cookie inválido, e o
proxy **apaga** os `sb-*-auth-token` (inclusive os partidos em `.0`, `.1`) ao
mandar pro login. Sem isso um cookie quebrado repete a viagem para sempre.

**Rota `/api/` não é redirecionada** — devolve `401` em JSON. Redirecionar faz
o `fetch` seguir o 307, receber o HTML do login com status 200, e o `.json()`
estourar como `Unexpected token '<'` na cara do usuário. Ver `comoJson()` em
`lib/agenda/api.ts`, que fecha o mesmo buraco do lado do navegador.

**Regras:**

- `getUser()`, nunca `getSession()`, para decidir se alguém está logado.
  `getSession()` confia no cookie sem validar com o servidor.
- O cliente de servidor é criado **por requisição**. Guardar em variável de
  módulo vaza a sessão de um usuário para outro.
- **Nunca filtrar por dono na query.** Quem isola é o RLS do banco.
  Filtro na aplicação é conveniência; RLS é a barreira.
- A chave `anon` é pública por design — ela vai no navegador. O que protege os
  dados é o RLS. A chave `service_role` **nunca** entra neste projeto, e nunca
  numa variável com prefixo `NEXT_PUBLIC_`.
- Preço de serviço é copiado para `agendamentos.preco_centavos` no momento do
  agendamento. Reajuste de tabela não pode reescrever o histórico.
- Mensagem de erro de login diz o que houve e o que fazer, em português, sem
  código de erro. Ver `mensagemDeErro()` em `app/entrar/acoes.ts`.

**Banco:** `0001_barbearias.sql` (contas), `0002_agendamentos.sql` (a agenda),
`0003_servicos_e_configuracao.sql` (cardápio e configuração),
`0004_produtos.sql` (estoque), `0005_loja.sql` (apelido público + as duas
views da vitrine) e `0006_sem_sobreposicao.sql` (a trava de horário). Não há
mais dado mockado no sistema.

**Número de migração é único.** Já houve duas `0004` ao mesmo tempo (produtos e
loja) — a da loja virou `0005`. Antes de criar uma, olhe a pasta.

**Serviços são uma tabela, não um enum.** A 0003 converteu: o enum
`servico_barbearia` foi apagado e `agendamentos.servico_id` aponta pra
`servicos`. Nome, valor, duração e cor são do dono, não do código. O que ficou
em `lib/agenda/tipos.ts` é só a **paleta** — os seis nomes de cor com par
claro/escuro medido. Serviço novo escolhe um desses nomes; hex no banco seria
cor que não sabe virar tema escuro.

**Preço é copiado para o agendamento** (`agendamentos.preco_centavos`) no
momento da marcação. Reajuste de tabela não pode reescrever quanto o cliente
pagou mês passado. Linha antiga sem cópia cai no preço atual do serviço — é
remendo de migração, não o caminho normal.

**Serviço não se apaga, se desativa.** A chave estrangeira é `on delete
restrict` de propósito: apagar um serviço agendado levaria junto o histórico.
`ativo = false` tira da legenda e do filtro sem mexer no passado. O índice
único de nome é parcial (`where ativo`), então dá pra reaproveitar o nome de um
serviço aposentado.

**Configuração da agenda** (`configuracao_agenda`) é uma linha por barbearia —
a chave primária É o `barbearia_id`, mesmo desenho de `barbearias`. Guarda dias
de atendimento (0 = domingo, mesma numeração de JS e do FullCalendar) e o
horário de abrir e fechar. Dia fechado aparece sombreado **e hachurado** no
calendário: nunca só o cinza.

**O "intervalo" do dono é a duração do serviço** (`servicos.duracao_min`), não
um campo separado de folga entre atendimentos. É o que define o fim do evento
no calendário. Se um dia entrar folga de limpeza entre clientes, ela é outra
coisa e precisa de outro nome na tela — dois "intervalos" confundem.

## Horário não pisa em horário

**Uma cadeira, um cliente por vez.** Um corte das 9h às 10h bloqueia 9h30 —
não só 9h em ponto.

Quem garante isso é a restrição `agendamento_sem_sobreposicao` (migração
0006): um `exclude using gist` sobre `barbearia_id` e a coluna gerada
`periodo`. Ela resiste a duas pessoas marcando no mesmo segundo; validação em
JavaScript não. `lib/agenda/conflitos.ts` faz o mesmo teste no navegador, mas
é só conveniência — as duas precisam concordar.

**Fim é exclusivo (`[)`).** 9h–10h e 10h–11h **não** conflitam. Sem isso, todo
horário emendado seria recusado, que é o contrário do que uma barbearia cheia
precisa.

**Cancelado libera o horário; "não compareceu" não.** O cliente furou, mas a
cadeira ficou ocupada esperando, e o histórico precisa continuar mostrando
isso. Por isso o `where (estado <> 'cancelado')` na restrição.

**Editar um agendamento RECOPIA preço e duração do serviço escolhido.** Não
contradiz o congelamento: o congelamento protege o histórico de um reajuste de
tabela feito depois, enquanto a edição é a dona reabrindo o agendamento e
dizendo o que ele é. Trocar de Cabelo para Cabelo + Barba sem recopiar deixaria
a agenda desenhando 30 minutos para um serviço de 50 — e a trava de
sobreposição calculando o intervalo errado.

**A duração fica em `agendamentos.duracao_min`, copiada no ato** — nunca lida
de `servicos` na hora de comparar. Mudar "Cabelo" de 30 para 60 minutos faria
todo horário passado esticar e inventar conflitos que nunca existiram. Mesma
regra do preço.

A antiga `unique (barbearia_id, data, horario)` saiu: só pegava o mesmo minuto,
e sem `where` recusava remarcar um horário que tinha sido cancelado.

**`data` e `horario` são colunas separadas, sem fuso.** A barbearia atende num
endereço só e o que vale é o relógio da parede. Um `timestamptz` faria "14:00"
virar outra coisa no horário de verão. Não "melhorar" isso para timestamptz sem
antes resolver o caso de rede com fusos diferentes.

O esquema pensado para clientes e produtos está em `supabase/rascunhos/` —
**não aplicado** (ver `supabase/rascunhos/LEIA.md`).

## Ambiente Windows — antivírus e TLS

O `.npmrc` do projeto define `node-options=--use-system-ca`. **Não remover.**

Antivírus com varredura de HTTPS (Norton, Kaspersky, ESET) interceptam a
conexão e reassinam os certificados com uma CA própria. O Windows confia
nela; o Node, que carrega a própria lista embutida, não — e toda chamada ao
Supabase morre com `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, aparecendo na aplicação
como um genérico `fetch failed`.

A flag manda o Node usar o armazenamento de certificados do Windows. **Continua
validando TLS** — só muda de onde vem a lista de autoridades confiáveis.

Consequências práticas:

- Rode os comandos **pelo npm** (`npm run dev`, `npm run supabase:verificar`).
  Chamar `node script.mjs` direto pula o `.npmrc` e pode falhar.
- A interceptação é **intermitente**: funciona numa hora e falha na outra.
  "Funcionou aqui" não descarta a hipótese.
- **NUNCA** usar `NODE_TLS_REJECT_UNAUTHORIZED=0`. Desliga a verificação
  inteira e transforma qualquer rede hostil em ataque de intermediário. Se a
  flag do sistema não bastar, o caminho é `NODE_EXTRA_CA_CERTS` apontando para
  o certificado da CA — nunca desligar a checagem.

## Formulário: o `Campo` faz a amarração

`Campo` (`components/ui/campo.tsx`) passa `id`, `aria-describedby` e
`aria-invalid` para o controle por contexto — `Input`, `Textarea`, `Select`,
`Checkbox` e `Switch` se acham sozinhos lá dentro. Fazer isso na mão é erro
silencioso: a tela parece certa e o leitor de tela anuncia "campo de edição"
sem dizer qual.

**Marcamos o opcional, não o obrigatório.** Quase tudo é obrigatório aqui;
asterisco em tudo é ruído, e asterisco sozinho comunica por símbolo e cor.

**Escolha tem a linha inteira como alvo, não a caixinha.** `Opcao` dá 44px de
altura e rótulo clicável; a caixa desenhada tem 20px mas o alvo real é 44px
(pseudo-elemento `before:`). Medido: 18px em qualquer direção ainda acerta.

**`Switch` aplica na hora; `Checkbox` marca escolha que salva depois.** Chave
dentro de formulário com botão "Salvar" mente sobre quando a coisa acontece.

## A loja é aberta — e por que isso muda o desenho

`/loja/<slug>` abre **sem sessão**: é o destino do QR code do balcão, e quem
aponta a câmera é cliente da barbearia, não dono dela. Três consequências que
não podem ser desfeitas por engano:

**Quem diz de qual barbearia é a loja é a URL, não o cookie.** Por isso
`barbearias.slug` existe. O slug **não muda quando o nome muda** — o QR code
já foi impresso e colado na parede.

**Rota aberta ≠ rota de entrada.** O `proxy.ts` tem duas listas: `ROTAS_ABERTAS`
(não exigem sessão) e `ROTAS_DE_ENTRADA` (quem já está logado é mandado pra
agenda). `/loja` está só na primeira; pôr na segunda expulsaria a dona da
própria loja.

**Sem sessão não há navegação nenhuma.** Nem sidebar, nem hamburguer — ver
`rotasVisiveis()` em `components/navegacao/rotas.ts`. Isso é conveniência de
tela, **não** é a barreira: quem barra rota é o proxy, quem barra dado é o RLS.

**Toda leitura pública passa por view, nunca pela tabela.** `public.lojas`
(id, slug, nome) e `public.loja_produtos` (id, barbearia_id, nome, preço,
disponível) são as únicas portas abertas. Trocar por `from("barbearias")` ou
`from("produtos")` faz a loja parar de abrir sem sessão — e abrir as tabelas ao
público entregaria telefone, lista de contas e o estoque inteiro.

**A vitrine mostra Mercearia e Produtos de Salão** — este último desde a
migração 0008, quando a barbearia passou a vender pomada e lâmina no balcão.
O que decide não é mais o tipo sozinho: entra na prateleira o item com preço
diferente de zero e pelo menos uma unidade. Salão sem preço continua sendo
insumo do barbeiro e fica só no estoque.

**Os nomes da agenda do dia são públicos — e isso foi escolhido, não
esquecido.** O seletor "Lançar em" do modal de compra existe para a venda cair
no atendimento certo, e a lista sai de `clientes_do_dia_loja`. A 0009 escondia
`cliente_nome` de quem não fosse a dona; a **0010 abriu para todo mundo**, a
pedido do Gabriel, depois de o efeito estar posto na mesa: `/loja/<slug>` abre
sem sessão, então o nome e o horário de quem tem hora marcada hoje ficam
visíveis a qualquer um com o link.

Duas coisas seguem valendo, e não são detalhe:

- **Só o dia corrente sai.** `p_data` vem de quem chama; ontem e amanhã
  continuam fechados. Não amplie isso sem perguntar.
- **Voltar atrás é barato.** O corpo da função na 0009 é a versão que
  mascarava — rodar aquele bloco de novo desfaz a 0010.

Se um dia isso virar opção da dona, o lugar é uma coluna em `barbearias`
(`loja_mostra_nomes`), lida dentro da função — não um `if` na tela, que
qualquer um contorna abrindo a resposta da RPC no navegador.

**Quantidade não vai pra vitrine.** A view expõe `disponivel` (booleano), não
`caixas`/`unidades`. Dois motivos: quanto tem em estoque é informação de
negócio, e o número seria mentira — uma caixa tem N unidades e o sistema ainda
não sabe quanto é N. Quando `unidades_por_caixa` existir, dá pra mostrar
quantidade de verdade.

Loja fechada (`loja_ativa = false`) some da view, então dá 404 igual a loja
inexistente. É de propósito: distinguir as duas entregaria quem tem conta.

## Ação de servidor nunca estoura

Toda ação em `app/(sistema)/agenda/acoes.ts` passa por `protegido()`. Sem essa
casca, uma exceção (o `getUser()` não alcançar o Supabase, por exemplo) sobe
como promessa rejeitada: o `useMutation` cai no `onError` genérico e o erro
cru **não aparece em lugar nenhum** — nem no log do servidor, nem no console do
navegador. Exceção vira `Resultado`, e o original vai pro `console.error`.

Do outro lado, o `onError` do cliente também registra o erro cru. Chegar lá
significa que a REQUISIÇÃO não completou — rede caída, ou o servidor recompilou
e o identificador da ação que aquela aba carregou não existe mais. O segundo
caso é rotineiro em desenvolvimento e a saída é recarregar, então a mensagem
diz isso em vez de mandar "tentar de novo" para sempre.

## Erros: traduzir para o usuário, registrar o original

Toda ação que fala com serviço externo grava o erro cru com `console.error`
antes de devolver a mensagem traduzida. Sem isso, "deu erro no cadastro" vira
adivinhação — foi exatamente o que aconteceu com o caso do TLS acima.

Mensagem de usuário não acusa o que não sabe: falha de transporte vira
"não consegui falar com o servidor de contas", nunca "verifique sua internet"
— o problema pode ser o servidor, o DNS, ou o antivírus da máquina.

## Confirmação de e-mail: ligada ou desligada

`app/cadastrar/acoes.ts` funciona nos dois modos e **não deve ser simplificado
para um só**:

- **Desligada** (`Confirm email` off no painel) — o Supabase devolve
  `data.session` preenchido. A ação redireciona direto pra `/agenda`.
- **Ligada** — não vem sessão. A tela vira "confirme seu e-mail", e o link
  cai em `app/auth/confirmar/`.

O que decide é `data.session`, não uma constante no código: assim virar a chave
no painel do Supabase não exige mexer no app.

**Antes de ir pra produção, religue a confirmação.** Sem ela qualquer pessoa
cria conta com o e-mail de outra, e a recuperação de senha — que manda link pro
e-mail cadastrado — passa a ser um caminho de invasão de conta.

## A comanda

Concluir um atendimento não fecha nada direto: abre a **comanda**, com o
serviço, o que o cliente consumiu e o total. Só o botão de dentro conclui.

O toque a mais é o recurso, não o custo. É ali que o barbeiro diz o valor em
voz alta para o cliente, e é assim que o refrigerante deixa de ser esquecido.

**De onde vem cada número.** O serviço é `agendamentos.preco_centavos`; o
consumo são as compras da loja lançadas naquele agendamento
(`vendas.agendamento_id`, migração 0009), lidas por
`listarItensDoAgendamento`. Os dois lados carregam preço congelado, então a
comanda de ontem continua batendo depois de qualquer reajuste.

**A soma mora em `totalDaComanda()`, em `lib/agenda/tipos.ts`** — não dentro
do componente. O dashboard vai precisar da mesma conta, e duas somas em
lugares diferentes é como o total da tela e o do relatório passam a discordar
sem ninguém notar. Quando o dashboard chegar, ele importa esta função.

**Uma linha por lançamento — iguais NÃO são somados.** Dois refrigerantes
pedidos em momentos diferentes aparecem em duas linhas, como na comanda de
papel, onde cada item é escrito quando é consumido. Juntar deixaria a lista
mais curta e tiraria a identidade de cada linha, e sem ela a edição do consumo
não saberia qual das compras o barbeiro quis mexer.

**Editar o consumo é rascunho até o "Salvar".** O bloco Consumo do modal de
editar mexe numa cópia; quem grava é `ajustar_comanda` (migração 0011), numa
chamada só. Dois motivos, e nenhum é preferência: o modal promete "Cancelar",
e se cada toque no `+` já baixasse estoque, cancelar não cancelaria nada; e
cada linha mexe em `produtos.unidades`, então uma sequência de chamadas que
falha no meio deixaria o estoque contando unidade que ninguém tirou da
prateleira. A RPC aplica tudo ou nada — erro lá dentro é `raise`, não
`return`, porque `return` no meio do laço já teria gravado o que passou.

**O estoque muda no Salvar; o CAIXA muda no Concluir.** São dois momentos
diferentes e a tela diz os dois, porque quem lança o refrigerante, olha o
dashboard e não vê o dinheiro acha que o lançamento se perdeu. A venda fica
gravada e fora do balanço até o atendimento concluir — ver `vendas_no_caixa`
em **Dashboard**.

Uma junta que NÃO é atômica: salvar o agendamento e salvar o consumo são duas
chamadas. Se a segunda falhar, a primeira ficou. A mensagem diz isso com
todas as letras ("O agendamento foi salvo, mas o consumo não…") em vez de um
"não consegui salvar" que faria a pessoa refazer o que já está no banco.

**Sem consumo carregado, o botão não some.** Enquanto a lista não chega, o
botão diz "Somando…" e fica desabilitado: um total que pula de R$ 30 para
R$ 38 depois de lido em voz alta é pior que um total que ainda não apareceu.
Se a leitura falhar, um aviso aparece e o atendimento pode ser concluído assim
mesmo — o corte aconteceu, e travar o fim do expediente por causa de uma
consulta é pior que a comanda incompleta.

## Dashboard

Três leituras, em ordem de urgência: **quanto entrou este mês** (os cartões),
**de onde veio** (as duas roscas), **como este mês se compara** (mês a mês).

**A regra do que entra na conta mora no banco e é a única cópia dela:**

- serviço conta quando o agendamento está `concluido` — foi atendido e pago;
- loja conta quando a venda está na view **`vendas_no_caixa` (0026)**.

`vendas_no_caixa` são as vendas `confirmada` que, além disso, ou são
**avulsas** (`agendamento_id` nulo — o balcão, o QR de quem só levou o
refrigerante) ou estão penduradas num agendamento **`concluido`**. Lançar um
produto na comanda não é receita ainda: vira receita no toque em Concluir.

**Por que view derivada e não um status `'pendente'` gravado.** Status gravado
desanda. Basta concluir sem querer e voltar o estado para `agendado` que a
venda fica `confirmada` para sempre, contando um dinheiro que a agenda diz que
não entrou — e ninguém percebe, porque o número está certo em uma tela e
errado na outra. Com a view existe uma fonte da verdade só: o estado do
agendamento. Concluir passa a contar, desconcluir para de contar, e não há o
que ficar fora de sincronia porque não há nada duplicado.

`resumo_dashboard` soma vendas em SEIS lugares (cartão, rosca de produtos,
série de meses, e as variantes com filtro de produto). A view existe para que
a regra não seja escrita seis vezes — é assim que se descobre, meses depois,
que uma das cópias não foi atualizada junto.

O MÊS da venda continua sendo o de `criado_em`, não o da conclusão: concluir
hoje um atendimento de ontem faz o número de ONTEM crescer, e é o certo — o
refrigerante saiu ontem.

**Uma chamada só para a tela inteira.** Cartões, roscas e a série de todos os
meses saem do mesmo resumo. Três requisições montariam a tela em pedaços, e
somar no navegador exigiria baixar o histórico a cada abertura — e ainda
erraria o mês das vendas, porque `criado_em` é `timestamptz` e o corte de mês
é o do relógio da barbearia (`FUSO_DA_BARBEARIA`), não o de Greenwich.

**As cores do gráfico são LIDAS do CSS, não copiadas.** O ApexCharts não
aceita `var(--serv-azul)`, então `useCoresDoGrafico()` lê os tokens do `:root`
em tempo de execução e relê a cada troca de tema. Repetir hexadecimal no
componente é como a paleta do gráfico começa a divergir da paleta da agenda no
primeiro ajuste.

**Gráfico é decoração; a lista é o dado.** Toda rosca vem com a lista ao lado,
e é ela que o leitor de tela lê — SVG de gráfico não se lê. Nenhum número pode
existir só dentro do desenho. Por isso o `<div>` do gráfico é `aria-hidden`.

**Rosca por quantidade, dinheiro ao lado.** A pergunta das duas pizzas é
demanda ("qual serviço sai mais"), e o serviço mais pedido nem sempre é o que
mais rende — mostrar as duas coisas na mesma linha é metade do que a tela tem
a dizer.

**Coluna para meses, não pizza.** Pizza responde "que fatia do todo"; a
pergunta aqui é "qual mês foi maior", que o olho compara por altura. Empilhada
em serviço e loja porque um mês pode crescer por dois motivos diferentes.

**Poucos meses = coluna estreita** (`larguraDaColuna`). Porcentagem com uma
categoria só vira um bloco atravessando a tela: grita e não compara com nada.

**Com um mês só, a tela diz que ainda não dá pra comparar.** "Mais forte",
"mais fraco" e "média" seriam o mesmo número três vezes — o que parece defeito
mesmo estando certo.

**A tela ocupa a largura toda:** sem `max-w`, sem `mx-auto`. É a única em que
comparar blocos vale mais que a coluna estreita de leitura. O respiro lateral
vem do `<main>` do layout, que é margem e não caixa.

## Nenhum input do sistema aceita acento

Regra do projeto, não preferência de tela: til, circunflexo, agudo, grave e
trema **não passam em campo nenhum**. Quem aplica é `semAcento()`, e as outras
três funções de `lib/formato.ts` são construídas em cima dela — a regra mora
num lugar só, senão um campo novo nasce esquecendo dela.

| função | onde | o que faz |
|---|---|---|
| `sanitizarNome` | cliente, barbearia, barbeiro, produto | maiúscula, sem acento, sem pontuação |
| `sanitizarNomeDeItem` | nome de serviço | igual, mais `+ - & /` |
| `sanitizarTextoLivre` | observação, pesquisa | só tira o acento |

**O ç passa e vira Ç.** Não é acento, é outra letra, e "ACAO" no lugar de
"AÇÃO" perde a palavra. Consequência visível: "Pigmentação" grava
**"PIGMENTAÇAO"** — cedilha de pé, til caído. Se um dia o Ç tiver que cair
também, o lugar é `semAcento()` e só ele.

**Os quatro conectores `+ - & /` ficam no nome de serviço** porque são parte
do nome: o exemplo do próprio formulário é "CABELO + BARBA", e a regra literal
de "sem caractere especial" viraria "CABELO BARBA".

**Texto livre não vira maiúscula e mantém pontuação.** A observação é uma
frase ("corta baixo dos lados, deixa a franja"), e vírgula e ponto fazem parte
dela. Na pesquisa a regra ainda ajuda a achar: os nomes gravados também não
têm acento.

**Espaço duplo só colapsa no servidor** (`nomeParaBanco`,
`nomeDeItemParaBanco`, `textoLivreParaBanco`). A cada tecla isso tiraria o
espaço da mão de quem ainda está digitando.

**E o servidor SEMPRE refaz.** Ação de servidor é endereço HTTP público: o
campo é conveniência de quem digita, a barreira é lá. O vazio é conferido
DEPOIS de sanitizar — quem mandou só "###" enviou três caracteres e não sobrou
nenhum.

## Navegação: toda tela é dinâmica, então toda tela tem `loading.tsx`

`/agenda`, `/estoque`, `/dashboard` e `/barbearia` são todas `ƒ` no build.
Cada clique espera DUAS idas ao Supabase antes de qualquer pixel mudar: o
`getUser()` do `proxy.ts` e a consulta do componente de servidor.

Sem `loading.tsx`, o navegador segura a tela **anterior** parada durante essa
espera — zero retorno. O barbeiro toca de novo achando que não pegou. Era
exatamente esse o sintoma de "sistema lento": não era o tempo, era o silêncio.

O `loading.tsx` resolve duas coisas de uma vez, e a segunda é a que quase
ninguém lembra: além do esqueleto imediato, ele é o que **permite o prefetch**
de rota dinâmica. Sem ele o `<Link>` não tem casca pra buscar adiantado, e o
prefetch não faz nada.

**O título vem escrito, não em cinza.** Ele é estático, o sistema já sabe qual
é antes de falar com o banco, e ver "Agenda" no instante do toque é o que diz
"peguei". Cinza no lugar do título esconderia o que já se tem. A exceção é o
subtítulo do dashboard, que diz o período escolhido — esse vira barra, porque
inventar um texto ali faria a linha TROCAR de conteúdo na chegada.

**O esqueleto tem a forma do que vai chegar.** Mesmas alturas, mesma grade,
mesma ordem de DOM (no celular o painel do dia vem antes do calendário nos
dois). Esqueleto genérico faz a tela pular quando o conteúdo entra.

**Cada link da navegação acende ao toque** (`useLinkStatus`, num componente
DENTRO do `<Link>` — o hook só responde ali). É o retorno do piscar entre o
toque e o esqueleto. Fica `aria-hidden`: quem usa leitor de tela já ouve o
`role="status"` do `loading.tsx`, e dois anúncios pra mesma espera atrapalham.

## Catálogo global de nomes: tentado e desfeito

A 0024 criou `nomes_de_servico` / `nomes_de_produto` — uma linha por nome no
banco inteiro, com `servicos.nome_id` apontando pra lá. A **0025 desfez**, a
pedido do Gabriel. As duas ficam na pasta: a 0024 chegou a rodar no banco, e
apagar o arquivo esconderia isso de quem replicar as migrações.

Se a ideia voltar, o que derrubou ela na prática foi o custo: compartilhar o
nome obriga a compartilhar a **grafia** (quem cadastra primeiro decide se é
"CABELO" ou "Cabelo" pra todo mundo), e tirar a coluna `nome` de verdade
exigiria reescrever sete funções do banco mais a camada TypeScript — em troca
de economizar alguns bytes de texto.

`normalizar_nome()` sobreviveu à 0025. É função pura de texto (sem acento,
minúsculo, espaços colapsados) e serve pra qualquer comparação de nome.

## Barbearia nova nasce com o cardápio vazio

Até a migração 0021 o gatilho `ao_criar_usuario` semeava Cabelo, Barba e
Cabelo + Barba com preço e duração inventados por nós. Isso veio da 0003, e era
**migração de dado**: os serviços saíram de um enum fixo no código e tinham que
continuar aparecendo pra quem já usava o sistema. Virou fato consumado para
conta nova sem nunca ter sido decidido como produto.

**A 0021 tirou.** O preço de um corte é a coisa mais particular de cada
barbearia: R$ 45,00 chutado por nós ou vira o preço errado no primeiro
agendamento, ou vira mais um item pra apagar antes de começar.

**O que continua nascendo pronto:** a linha em `barbearias` (com o apelido
público) e a linha em `configuracao_agenda` (horário padrão). Sem a
configuração o calendário não sabe quando a loja abre e a tela abre torta.
Horário padrão é palpite corrigível; preço não é.

**Cardápio vazio é a primeira tela de todo dono novo, então ela tem que ter
saída.** A `Legenda` sem serviço nenhum deixa de ser filtro e vira o convite
("Cadastrar serviço", abrindo a configuração) — um "Todos" sozinho filtrando
nada seria a primeira coisa que ele veria na vida. O modal de agendamento e a
tela pública já diziam o que falta; o aviso do link de agendamento online
agora também, porque conta nova não tem serviço **nem** equipe.

Se um dia o cardápio de exemplo voltar, que volte como ESCOLHA na tela de
cadastro ("começar com um cardápio de exemplo?"), nunca como fato consumado
dentro do gatilho.

## Excluir agendamento apaga; cancelar guarda

O botão de excluir mora no CORPO do modal de editar, nunca no rodapé: lá ele
ficaria encostado no "Cancelar", que ali significa "fechar sem salvar" e não
"desmarcar o cliente". Duas palavras parecidas com efeitos opostos, a um dedo
de distância.

**Dois toques.** O primeiro troca o bloco por um `Alerta` que diz quem, quando
e o que se perde; só o segundo apaga. Sem volta merece a pergunta.

**Excluir ≠ cancelar.** `estado = 'cancelado'` libera o horário e MANTÉM a
linha; excluir some com ela. Horário marcado por engano se exclui; cliente que
desmarcou se cancela — o mês que vem vai querer saber quantos desmarcaram, e o
registro apagado não conta isso. O texto na tela diz essa diferença, porque
quem está com pressa não vai adivinhar.

**O consumo lançado no atendimento SOME JUNTO, e o estoque volta.** Quem apaga
é a RPC `excluir_agendamento` (0026), não um `delete` na tabela: ela devolve as
unidades à prateleira, apaga as vendas e só então apaga o agendamento — tudo ou
nada, porque três escritas separadas deixariam o estoque contando unidade que
ninguém tirou da prateleira se a segunda falhasse. Excluir diz "isto nunca
deveria ter existido", e então o que foi lançado dentro também não existiu. Se
a compra foi mesmo paga, ela se lança de novo pela loja como avulsa — e o
aviso da confirmação diz isso, nomeando quantas unidades e quantos reais
voltam.

**Isto já foi o contrário, e era um bug.** `vendas.agendamento_id` era
`on delete set null`, sob o argumento de que "o dinheiro entrou". Só que venda
com `agendamento_id` nulo é exatamente como uma compra AVULSA se parece: a
venda de um agendamento apagado virava, sozinha, receita de balcão. A coluna é
`on delete cascade` desde a 0026 — não como caminho normal (a RPC apaga as
vendas antes), mas como rede de baixo para quem apagar a linha direto no painel
do Supabase.

Excluir invalida `chaves.dashboard.todas` **e** `chaves.estoque.todas`: o
balanço não pode continuar somando um atendimento que não existe mais, e a tela
de Estoque não pode continuar escondendo a unidade que acabou de voltar.

## Folga é a exceção da semana, não a semana

"Dias de atendimento" responde **toda semana** — desmarcar a segunda fecha
todas as segundas do ano. Folga (tabela `folgas`, migração 0020) responde
**um dia**: feriado, viagem, casamento. São perguntas diferentes e por isso
moram em tabelas diferentes; a segunda foi feita porque a primeira não
consegue dizer "dia 7 eu não abro".

Na tela elas ficam juntas — o botão **Folgas** na mesma fileira dos dias da
semana — porque na cabeça da dona a pergunta é uma só: "quando eu abro".

**Folga NÃO cancela ninguém.** Ela fecha o dia para horário NOVO; quem já
estava marcado continua na agenda. Apagar agendamento por tabela seria decidir
no lugar da dona, e ela é quem sabe se já avisou o cliente. Por isso
`marcarFolga` devolve `aviso` com quantas pessoas já estão naquele dia — a
tela consegue contar isso sem ter o mês inteiro carregado, e sumir com o
número seria mentir por omissão.

**Três lugares recusam, e é de propósito:** o formulário (para dizer ONDE
desmarcar), a ação de servidor (`criarAgendamento` e `atualizarAgendamento`,
que é o endereço HTTP público) e a RPC pública `criar_agendamento_publico`.
Editar também checa: mover um horário PARA um dia de folga é marcar num dia
fechado. Já quem estava lá antes continua editável — a checagem é sobre a data
de destino.

**Folga tem hachura própria (`.dia-de-folga`), não entra no `businessHours`.**
No `.fc-non-business` ela ficaria idêntica a um domingo, e "fechei neste
feriado" viraria "nunca abro nesse dia". A hachura é mais densa e o rótulo
"Folga" fica escrito na célula — nunca só o cinza.

**A tela pública recebe um booleano, não a lista.** `agenda_publica` devolve
`folga` do dia consultado. Mandar as folgas do mês contaria pra fora quando a
barbearia está vazia, e quem abre o link não tem o que fazer com isso.

**Sem a 0020 a agenda continua abrindo.** `listarFolgas` devolve `[]` no
`42P01` em vez de estourar: essa leitura vem grudada na configuração e no
cardápio, e derrubá-la levaria junto a legenda e a lista de serviços. Quem
tentar MARCAR uma folga é que recebe o erro, com o nome do arquivo.

**Folga que já passou não se desmarca.** O mini calendário não deixa marcar
antes de hoje, e a lista só mostra as próximas: o dia acabou, e o sombreado no
calendário é histórico — desfazer não desfaz nada.

## O modal abre no próximo horário livre

`proximoHorarioLivre` (`lib/agenda/horarios.ts`) escolhe o horário que o campo
mostra ao abrir "Novo agendamento" — e o mesmo vale para a tela pública. Antes
era sempre a abertura da loja, o que só estava certo às 9 da manhã: às 15h,
com a manhã cheia, quem marcava corrigia o campo toda vez, e quem esquecia
levava um "horário ocupado" que ele mesmo tinha acabado de causar.

A varredura anda de 15 em 15 — o mesmo `PASSO_MIN` do arraste e do `step` do
campo — e um horário só serve se **termina** antes de fechar: sugerir 18:45
para um corte de 1h numa loja que fecha às 19h empurra o problema pro barbeiro.
Quem responde se está livre é a `conflitoCom` do formulário, a mesma; duas
respostas diferentes para a mesma pergunta é como o aviso e a tela divergem.

**Sendo hoje, o piso é o relógio**, arredondado pra cima: às 14:07 o próximo
começo é 14:15. Em outro dia o piso é a abertura — a hora do relógio não tem
nada a ver com terça que vem.

**Nada disso pode ler o relógio durante a hidratação.** O modal só calcula com
`aberto` verdadeiro (a `key={sessao}` remonta a cada abertura, então o cálculo
cai na hora do clique); a tela pública recebe o valor **pronto do servidor**,
por prop. Ler `agoraNaBarbearia()` num `useState` que roda no servidor repete
o defeito do seletor de barbeiro: o HTML sai com uma hora, o navegador hidrata
com outra.

Sem vaga nenhuma — dia cheio, ou já passou da hora de fechar — a função
devolve `null`, e quem chama volta pra abertura. `null` explícito em vez de um
"09:00" silencioso: o dia escolhido é que está errado, e o conserto é trocar a
data.

## O bloco de horário arrasta

Na linha do tempo do modal de agendamento, o bloco âmbar é arrastável. Três
jeitos de escolher a hora, e os três encaixam de 15 em 15 (`PASSO_MIN`): tocar
na faixa, arrastar o bloco, ou setas com o bloco em foco (Shift = de hora em
hora). Passo diferente entre eles faria um dedo dar 16:07 e o outro 16:00.

**Pointer Events, não mouse + touch separados.** Um caminho só para dedo,
caneta e mouse, e `setPointerCapture` mantém o arraste vivo quando o ponteiro
sai do bloco — que é o normal ao puxar rápido. O bloco leva `touch-none`,
senão o navegador rola a faixa em vez de arrastar.

**Arrastar não pode ser o único jeito.** `role="slider"` com `aria-valuetext`
no formato "16:00 às 17:00" (o leitor de tela não lê "980" como horário), mais
as setas. Para cima = mais cedo, seguindo o que o olho vê na faixa, e não a
convenção de slider em que subir aumenta o valor.

**Duas armadilhas que já morderam, e por isso estão marcadas no código:**

- a rolagem automática que centraliza o bloco **precisa ficar quieta durante o
  arraste** (`arrastandoRef`), senão a faixa foge debaixo do dedo a cada pixel;
- o clique no bloco **para de subir** (`stopPropagation`), senão soltar o
  arraste conta como clique na faixa e joga o bloco pra posição do ponteiro.

`definirInicio()` compara com o horário atual antes de avisar o formulário:
sem isso, cada pixel de arraste viraria um render do modal inteiro, checagem
de conflito junto.

**Limite conhecido:** não há auto-rolagem ao arrastar até a borda. Para mover
o bloco além do trecho visível, rola-se a faixa antes.

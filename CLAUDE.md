# MazyOS — Sistema operacional do negócio

Sua empresa roda em cima desse arquivo. Aqui ficam as regras de operação
do MazyOS — como o Claude lê o contexto, aprende com correções, mantém
tudo atualizado e cria skills novas conforme a operação evolui.

Esse arquivo é editável. Quando o `/instalar` rodar, ele complementa o
final dessa página com as regras específicas do seu negócio.

---

## Contexto do negócio

No início de toda conversa, ler os seguintes arquivos (quando existirem
e estiverem preenchidos):

1. `_memoria/empresa.md` — quem é o usuário, o que faz, como funciona o negócio
2. `_memoria/preferencias.md` — tom de voz, estilo de escrita, o que evitar
3. `_memoria/estrategia.md` — foco atual, prioridades, prazos

Usar essas informações como base pra qualquer resposta ou decisão. Ao
sugerir prioridades, formatos ou abordagens, considerar o foco atual
descrito em `estrategia.md`.

Pra qualquer tarefa visual (carrossel, post, landing page), consultar
`identidade/design-guide.md` como referência de estilo.

Não é necessário listar o que foi lido nem confirmar a leitura. Apenas
usar o contexto naturalmente.

---

## Fluxo de trabalho

Antes de executar qualquer tarefa, verificar se existe skill relevante
em `.claude/skills/`. Se encontrar, seguir as instruções da skill. Se
não encontrar, executar a tarefa normalmente.

Ao concluir uma tarefa que não tinha skill mas parece repetível (o
usuário provavelmente vai pedir de novo no futuro), perguntar:

> "Isso pode virar uma skill pra próxima vez. Quer que eu crie?"

Não perguntar pra tarefas pontuais ou perguntas simples. Só quando o
padrão de repetição for claro.

---

## Aprender com correções

Quando o usuário corrigir algo, melhorar uma resposta ou dar uma
instrução que parece permanente (frases como "na verdade é assim", "não
faça mais isso", "prefiro assim", "sempre que...", "evita...", "da
próxima vez..."), perguntar:

> "Quer que eu salve isso pra não precisar repetir?"

Se sim, identificar onde faz mais sentido salvar:

- **Sobre o negócio** (clientes, serviços, mercado) → `_memoria/empresa.md`
- **Sobre preferências e estilo** (tom de voz, formato, o que evitar) → `_memoria/preferencias.md`
- **Sobre prioridades e foco** (projetos, metas, prazos) → `_memoria/estrategia.md`
- **Regra de comportamento nessa pasta** → próprio `CLAUDE.md`

Salvar com uma linha nova clara, sem reformatar o arquivo inteiro.
Confirmar mostrando a linha adicionada.

Não perguntar se a correção for óbvia de contexto imediato (ex: "na
verdade o arquivo se chama X"). Só perguntar quando a informação tiver
valor duradouro.

---

## Manter contexto atualizado

Ao terminar uma tarefa que mudou algo relevante (cliente novo, skill
nova, mudança de foco, processo novo, ferramenta instalada, estrutura
alterada), perguntar:

> "Isso mudou algo no teu contexto. Quer que eu atualize a memória?"

Se sim, identificar o que atualizar:

- **Cliente, serviço, ferramenta, equipe** → `_memoria/empresa.md`
- **Mudança de prioridade ou foco** → `_memoria/estrategia.md`
- **Tom ou estilo** → `_memoria/preferencias.md`
- **Pasta, regra de organização, skill criada** → `CLAUDE.md`
- **Visual (cores, fontes, logo)** → `identidade/design-guide.md`

Mostrar o que vai mudar antes de salvar. Não reformatar o arquivo
inteiro, só adicionar ou editar a linha relevante.

**Quando NÃO perguntar:**
- Tarefas pontuais sem impacto no contexto (escrever um email avulso, criar um post)
- Perguntas simples ou conversas sem ação
- Mudanças já salvas pelo bloco "Aprender com correções"

**Dica:** rode `/atualizar` pra uma varredura completa quando houver dúvida.

---

## Criação de skills

Quando o usuário pedir skill nova:

1. Verificar se existe template relevante em `templates/skills/`. Se
   existir, usar como base e adaptar pro contexto
2. Perguntar se é específica desse projeto ou útil em qualquer:
   - Específica → `.claude/skills/nome-da-skill/SKILL.md` (local)
   - Universal → `~/.claude/skills/nome-da-skill/SKILL.md` (global)
3. Ler `_memoria/empresa.md` e `_memoria/preferencias.md` pra calibrar
   o conteúdo da skill ao contexto do negócio
4. Se a skill precisar de arquivos de apoio (templates, exemplos),
   criar dentro da pasta da skill
5. Seguir o fluxo da skill-creator nativa do Claude Code

---

# BARBOS — perfil solopreneur

> Bloco escrito pelo `/instalar`. Molde de **criador solo** adaptado: uma pessoa,
> um produto próprio. O sistema gira em torno do que você constrói e publica.

## O que é esse workspace

Operação do BARBOS — sistema de gestão para barbearias. Aqui eu construo o
produto, a marca por trás dele e o material que sai dele.

**Estrutura de pastas:**
- `_memoria/` — quem eu sou, como falo, o que tá em foco
- `sistema/` — **o produto**: app Next.js (App Router) + Tailwind + shadcn +
  React Query. Regras próprias em `sistema/AGENTS.md`
- `identidade/` — manual de marca, tokens e biblioteca de logos
- `marketing/` — conteúdo, SEO, campanhas (parado por enquanto)
- `saidas/` — análises, emails, documentos pontuais
- `dados/` — arquivos a analisar (CSV, PDF, planilha)
- `scripts/` — utilitários
- `templates/` — moldes de perfil e de skill

## Quem sou

Toco o BARBOS sozinho. Construo um sistema de gestão para barbearias — agenda,
serviços e estoque — para donos que hoje ainda anotam tudo em caderno físico.

## O que produzo

- O sistema BARBOS (produto principal) — em `sistema/`, esqueleto no ar
- Manual de marca do BARBOS: tipografia, paleta e logo — **v1 pronto** (`identidade/`)

## Meu cliente

Dono de barbearia com uma ou mais cadeiras, com estoque e serviços pra
controlar, que atende e gerencia a agenda em caderno físico. Não é alguém
migrando de outro software — é alguém saindo do papel.

## Posicionamento

O concorrente é o caderno. Simplicidade e velocidade de uso valem mais que
lista de recurso.

## Regras do sistema

- Foco atual é produto e marca. Não sugerir conteúdo, anúncio ou campanha sem
  eu pedir explicitamente.
- Antes de qualquer coisa visual, ler `identidade/design-guide.md` — o manual
  de marca está preenchido (v1). Toda cor sai de `identidade/tokens.css` ou
  `tokens.json`; hex solto no código é erro de revisão.
- Todo par texto/fundo novo precisa de 4,5:1 (texto) ou 3:1 (borda e ícone de
  UI). Medir, não estimar no olho.
- Alvo de toque nunca abaixo de 44px. Tema escuro nasce junto com o claro.
- Não inventar tom de voz de marca — não tem exemplo de escrita minha ainda.
- Resposta curta e direta, com recomendação em vez de menu de opções.

## Ferramentas conectadas

- [ ] Notion
- [ ] Canva
- [ ] Google Calendar
- [ ] Meta Ads
- [ ] Google Ads

*(Marcar conforme for instalando os MCPs)*

# site — a apresentação do BARBOS

Projeto **separado** do `sistema/`. Vive em `site.barboss.com.br`, com
deploy próprio na Vercel.

## Por que separado

O sistema tem sessão, cookie, banco e chaves. Este site não tem nada
disso: é estático, não guarda segredo nenhum e pode ser reconstruído do
zero sem risco para quem está com cliente na cadeira. Mexer aqui nunca
derruba a agenda de ninguém.

## Rodar

```sh
npm install
npm run dev     # http://localhost:3100
```

A porta é **3100** de propósito — para o site e o sistema (3000) rodarem
ao mesmo tempo na mesma máquina.

## Deploy

Projeto próprio na Vercel, apontando para este diretório
(**Root Directory = `site`**), no mesmo repositório do sistema.

**Nenhuma variável de ambiente.** Se um dia este projeto precisar de uma
chave, vale reler o motivo da separação antes de adicioná-la.

## A marca

As cores e os logos foram **copiados** de `identidade/`, não importados:
com a Root Directory em `site/`, nada acima desta pasta entra no build.
A fonte da verdade continua sendo `identidade/design-guide.md` — se o
manual mudar, `app/globals.css` e `public/marca/` precisam ser
conferidos na mão.

## De onde vêm as imagens

Todas foram geradas no Higgsfield e tratadas aqui. Nenhuma é foto de
banco de imagens, e nenhuma tem marca de outra empresa.

| Arquivo | Como foi feito |
|---|---|
| `public/heroi/cena.*` | Imagem da barbearia à noite (GPT Image 2.5) → vídeo de 5s com a câmera avançando (Kling 3.0 Turbo) → `scripts/cena-do-heroi.sh` |
| `public/tesoura/t*.webp` | Foto da tesoura de perfil sobre preto (GPT Image 2.5) → vídeo de 5s abrindo e fechando (Kling 3.0 Turbo) → `scripts/quadros-da-tesoura.py` |
| `public/cadeira/q*.webp` | Foto da cadeira → fundo removido → montada sobre um halo âmbar → vídeo de giro de 5s → `scripts/quadros-da-cadeira.sh` |
| `public/ferramentas/*.webp` | Uma imagem por peça, fundo removido, aparada na caixa do objeto |
| `public/caderno.webp` | Imagem direta, **com** o fundo de madeira: ali a madeira velha é o argumento, não um deslize do manual |

O halo âmbar da cadeira está **gravado nos quadros**, não é CSS. Por isso
o canvas do capítulo final leva uma máscara radial: sem ela aparece a
costura retangular do canvas contra o fundo da página.

## Os três tipos de movimento

O site é contado em sete capítulos (`lib/capitulos.ts`), e cada um mistura
três tipos de movimento. O comentário no topo de cada seção diz qual é
qual:

| Capítulo | Rolagem | Sozinho | Mouse |
|---|---|---|---|
| 01 Herói | texto sai desfocando, câmera entra na cadeira | vídeo em loop, avisos do sistema chegando | luz âmbar segue o cursor, parallax da cena |
| 02 Ferramentas | peças chegam voando, acendem uma a uma, convergem no símbolo | peças flutuando, brilho atravessando o aço | parallax por profundidade; passar o mouse acende peça e item juntos |
| 03 Telas | a tela se monta peça por peça (`--p`) | — | holofote sobre a interface, inclinação leve |
| 04 Caderno | a tesoura corta o caderno, as metades se soltam | a comparação risca o caderno sozinha | o quadro inclina, reflexo anda junto |
| 05 Celular | — | chaves viram sozinhas, aviso de agendamento | o aparelho inclina; as chaves funcionam no toque e mudam o total |
| 06 Passos | a linha corre de um passo ao outro | números contam do zero | luz que segue o cursor dentro do cartão |
| 07 Começar | o anel de luz se desenha | faísca correndo no anel, cadeira passeando | a cadeira gira acompanhando o cursor |

Por cima de tudo: a faixa barbearia do topo mede a leitura, o trilho de
capítulos na direita (só em tela larga), o anel que segue o mouse
(`components/ui/cursor.tsx`) e a rolagem com inércia do Lenis.

**Use `useProgresso`, não o `scrollYProgress` do `useScroll`.** Desde a
12.x o motion entrega opacidade e transform a uma `ViewTimeline` nativa,
que ignora o `offset` e mede a seção inteira cruzando a tela. Numa seção
presa de 300vh, o texto ficava pela metade. O motivo completo está em
`components/ui/progresso.ts`.

**Movimento reduzido:** as seções presas viram seções de altura normal, o
vídeo fica parado no pôster, o Lenis e o cursor nem ligam, e tudo que
entraria em cascata já aparece pronto. Quando um estilo animado é trocado
por um fixo, passe valores (`{ opacity: 1 }`), nunca `undefined` — o
motion não apaga o que já tinha escrito no elemento.

## A coreografia

Toda seção animada é uma `<Cena>`. Ela mede o quanto já atravessou a tela
e escreve isso em `--p`, de 0 a 1, direto no DOM — uma variável, uma vez
por quadro, sem re-renderizar nada. O resto é CSS (`.entra`, `.cresce`,
`.entra-moldura` em `app/globals.css`).

Duas consequências que valem saber antes de mexer:

- **A animação é reversível de graça.** Rolar para cima desmonta a tela na
  ordem inversa, porque tudo é função de `--p` e não um gatilho.
- **`--p` começa em 1, não em 0.** Se o JavaScript não rodar, a página
  aparece montada em vez de aparecer vazia. É também o que quem pediu
  movimento reduzido vê: a `Cena` nem chega a escrever na variável.

# Identidade visual — BARBOS

> Manual de marca do BARBOS. Como a marca aparece em tudo que o sistema e o
> MazyOS geram. As skills de conteúdo, carrossel, proposta e slide leem esse
> arquivo antes de criar qualquer visual — e a construção do sistema também
> sai daqui.
>
> Todos os contrastes deste documento foram medidos (WCAG 2.1). Os números
> estão anotados em cada par.

---

## Direção da marca

O concorrente do BARBOS é o **caderno físico**, não outro software.

Isso decide o visual inteiro:

- **Nada de azul-SaaS genérico.** O BARBOS não está brigando por atenção numa
  lista de ferramentas — está substituindo papel.
- **Nada de vintage-barbearia.** Poste listrado, navalha, bigode e madeira
  envelhecem rápido, viram clichê e somem num ícone de 16px.
- **Sóbrio, denso e rápido de ler.** O barbeiro abre o app com o cliente
  sentado na cadeira. Cada tela tem que responder "quem é o próximo" em menos
  de um segundo.

**Fórmula:** grafite frio + âmbar. Grafite é a estrutura. Âmbar é a ação —
e só a ação. O elemento "barbearia" entra como faixa diagonal no sistema,
nunca dentro do símbolo.

---

## Cores

### Marca

- **Fundo principal:** Grafite `#14171C` (`graf-900`)
- **Cor de destaque / CTA:** Âmbar `#F0A93B` (`ambar-500`)
- **Texto principal:** Grafite `#14171C` no claro, Branco `#FFFFFF` no escuro
- **Fundo alternativo / cards:** `#F4F6F8` (`graf-50`) no claro, `#1C2027` (`graf-800`) no escuro
- **Cor proibida:** azul-SaaS saturado (`#0066FF` e vizinhos) como cor de marca,
  vermelho/branco/azul de poste de barbeiro, e qualquer gradiente na identidade

### Escala grafite (estrutura)

| Token | Hex | Uso |
|---|---|---|
| `graf-950` | `#0D0F12` | Fundo do app no tema escuro |
| `graf-900` | `#14171C` | Cor da marca, texto principal no claro |
| `graf-800` | `#1C2027` | Superfície elevada no escuro (card, modal) |
| `graf-700` | `#2A2F38` | Borda no tema escuro |
| `graf-500` | `#5B6472` | Texto secundário no claro — 5,98:1 |
| `graf-400` | `#7C8595` | Borda de campo no claro (3,72:1), texto desabilitado |
| `graf-300` | `#A8B0BC` | Texto secundário no escuro — 8,77:1 |
| `graf-200` | `#C9CFD8` | Divisor forte |
| `graf-100` | `#E4E7EC` | Divisor sutil, fundo de estado neutro |
| `graf-50`  | `#F4F6F8` | Fundo do app no tema claro |
| `branco`   | `#FFFFFF` | Superfície de card no claro |

### Escala âmbar (ação)

| Token | Hex | Uso |
|---|---|---|
| `ambar-800` | `#8A5309` | Âmbar como **texto** no claro — 6,32:1 |
| `ambar-700` | `#A9660F` | Âmbar pressionado / borda de foco escura |
| `ambar-600` | `#D98E1E` | Hover do botão primário |
| `ambar-500` | `#F0A93B` | **Preenchimento do CTA e do símbolo da marca** |
| `ambar-300` | `#F7CE8A` | Anel de foco |
| `ambar-100` | `#FCEDD3` | Fundo suave de destaque e do badge "em atendimento" |

**Regra dura do âmbar:** âmbar é *preenchimento*, nunca *texto sobre branco*
na sua versão clara. Branco sobre `ambar-500` dá **2,01:1** — reprovado em
qualquer critério. Texto sobre âmbar é sempre `graf-900` (**8,93:1**). Âmbar
como texto no fundo claro só na versão `ambar-800`.

E âmbar não é decoração: se tudo é âmbar, nada é ação. Uma tela deve ter
**um** botão âmbar. No máximo.

### Estados da agenda

O coração do produto. Cada estado tem cor de texto e fundo próprios, todos
medidos:

| Estado | Texto | Fundo | Contraste |
|---|---|---|---|
| Agendado | `#1B4FBF` | `#E4EDFD` | 6,11:1 |
| Confirmado | `#146C45` | `#E1F4EA` | 5,62:1 |
| Em atendimento | `#8A5309` | `#FCEDD3` | 5,48:1 |
| Concluído | `#5B6472` | `#E4E7EC` | esmaecido de propósito — já passou |
| Não compareceu | `#B42318` | `#FDE7E5` | 5,55:1 |
| Cancelado | `#5B6472` | `#F4F6F8` | texto tachado |

**Nunca comunicar estado só por cor.** Barbeiro daltônico existe, e sol na
tela lava cor. Todo badge de estado carrega **texto + cor**, e os dois
estados que geram prejuízo (Não compareceu, Cancelado) carregam também
**ícone**.

### Estoque

| Estado | Cor |
|---|---|
| Em estoque | `#146C45` |
| Estoque baixo | `#8A5309` |
| Sem estoque | `#B42318` |

### Feedback do sistema

| Tipo | Texto | Fundo |
|---|---|---|
| Sucesso | `#146C45` | `#E1F4EA` |
| Erro / destrutivo | `#B42318` | `#FDE7E5` |
| Alerta | `#8A5309` | `#FCEDD3` |
| Informação | `#1B4FBF` | `#E4EDFD` |

---

## Tipografia

Duas fontes. As duas gratuitas, no Google Fonts.

- **Títulos e destaques:** **Archivo Black** — *exclusiva do logotipo*.
  Não usar em título de tela, não usar em botão, não usar em texto corrido.
  Ela existe pra assinar a marca e mais nada.
- **Corpo, subtítulos e botões:** **Inter** — toda a interface do sistema,
  sem exceção. Uma família só na UI significa app mais leve e zero decisão de
  fonte no meio do desenvolvimento.
- **Peso do título:** 700 (Inter Bold) para títulos de tela; 600 (SemiBold)
  para subtítulos e rótulos.

### Escala

| Papel | Tamanho / entrelinha | Peso | Observação |
|---|---|---|---|
| Display | 32 / 40 | 700 | Número grande de painel |
| Título de tela (H1) | 24 / 32 | 700 | |
| Seção (H2) | 20 / 28 | 600 | |
| Subtítulo (H3) | 17 / 24 | 600 | |
| Corpo | 16 / 24 | 400 | **Base. Nunca abaixo de 16px em tela de toque.** |
| Corpo forte | 16 / 24 | 600 | Nome do cliente, valor do serviço |
| Pequeno | 14 / 20 | 400 | Apoio, metadado |
| Rótulo | 13 / 16 | 600 | Caixa alta, tracking `0.04em` |
| Legenda | 12 / 16 | 400 | Menor tamanho permitido. Nunca em informação crítica |

### Números

Horário, preço e quantidade **sempre** com `font-variant-numeric: tabular-nums`.
Sem isso a coluna de horário da agenda dança a cada minuto que muda, e o olho
perde a linha. Isso não é preciosismo — é a tela que o barbeiro mais olha.

---

## Estilo geral

Denso, quadrado e direto. Estrutura visível: card com borda, não card
flutuando em sombra. Pouca animação — o app abre no meio do atendimento, não
numa apresentação. Espaço generoso na vertical, apertado na horizontal (tela
de celular é estreita).

Se estiver na dúvida entre bonito e óbvio, escolhe óbvio.

---

## Elementos-chave

- **Bordas:** 1px. `graf-400` (`#7C8595`) em campo de formulário — precisa dos
  3:1 de contraste pra ser identificável. `graf-100` em divisor decorativo.
  No tema escuro a borda de campo continua `graf-400` — `graf-700` dá 1,34:1 e
  o campo some (ver anexo). `graf-700` só como divisor decorativo no escuro.
- **Border-radius dos cards:** 8px em card, campo e botão. 12px em modal e
  bottom sheet. 999px em badge e pill. O símbolo da marca usa squircle
  (superelipse), não radius comum — por isso ele é PNG, não CSS.
- **Botões:**
  - *Primário* — fundo `ambar-500`, texto `graf-900` (8,93:1), altura 48px,
    sem borda. Um por tela.
  - *Secundário* — fundo transparente, borda `graf-400`, texto `graf-900`.
  - *Fantasma* — só texto `graf-900`, sem fundo nem borda.
  - *Destrutivo* — texto `#B42318` sobre `#FDE7E5`. Cancelar agendamento
    **sempre** pede confirmação.
- **Sombras:** dois níveis, só isso.
  - `sombra-1` (card elevado): `0 1px 2px rgba(13,15,18,.06), 0 1px 3px rgba(13,15,18,.10)`
  - `sombra-2` (modal, menu): `0 8px 24px rgba(13,15,18,.14)`
- **Alvo de toque:** mínimo **44×44px**, ideal 48. Não negociável — ver
  "Contexto de uso".
- **Faixa barbearia:** o único aceno visual ao ofício. Faixa diagonal
  âmbar/grafite de 4 a 6px de altura, usada no topo da tela de login, em
  estado vazio e como divisor de seção principal. Nunca dentro do logo, nunca
  como fundo de tela inteira.

```css
background: repeating-linear-gradient(45deg,
  #F0A93B 0 12px, #14171C 12px 24px);
```

---

## Contexto de uso — o que decide o design do BARBOS

Isso não é enfeite de manual. É o motivo de cada regra acima.

1. **O barbeiro usa com uma mão só,** com a outra segurando máquina, tesoura
   ou o celular do cliente. Ação principal fica na **metade inferior** da
   tela, ao alcance do polegar. Nada crítico no topo.
2. **A tela está suja, molhada ou com talco.** Alvo de toque grande, e
   distância mínima de 8px entre dois alvos.
3. **Tem sol na vitrine.** Por isso texto secundário é `graf-500` e não um
   cinza claro qualquer, e por isso nada de informação crítica em 12px.
4. **Tema escuro não é enfeite** — é a barbearia à noite com a tela no balcão.
   O tema escuro nasce junto com o claro, não depois.
5. **A tela inicial é a agenda de hoje.** Não é painel, não é resumo, não é
   gráfico. É a lista do dia, ordenada por horário, com o próximo cliente em
   destaque.
6. **O usuário vem do caderno.** Ele já sabe o que quer ver. O sistema tem que
   parecer uma página do caderno que se organiza sozinha — não um ERP.

---

## O que NUNCA fazer

- Texto branco sobre âmbar (2,01:1 — ilegível)
- Mais de um botão âmbar na mesma tela
- Comunicar estado de agendamento só por cor, sem texto
- Archivo Black fora do logotipo
- Texto abaixo de 12px, ou informação crítica abaixo de 14px
- Alvo de toque menor que 44px
- Distorcer, girar, aplicar sombra, gradiente ou contorno no logo
- Recolorir o símbolo fora das variações fornecidas
- Escrever "Barbos", "BarbOS" ou "barbos" em material de marca — é **BARBOS**,
  caixa alta
- Poste de barbeiro, tesoura, navalha ou bigode como ícone da marca
- Estado vazio sem saída ("Nenhum agendamento" sem o botão de criar um)

---

## Logo

- **Arquivo:** `identidade/logo.png` (lockup horizontal, fundo claro)
- **Versão pra fundo escuro:** `identidade/logo-branco.png`
- **Biblioteca completa:** `identidade/logo/`
- **Onde usar:** cabeçalho do sistema, tela de login, ícone do app, slide
  final de carrossel, cabeçalho de proposta
- **Tamanho sugerido:** largura entre 120-200px nos HTMLs

### Construção

Símbolo: squircle (superelipse n=4,5) âmbar com "B" em Archivo Black grafite,
ocupando 54% da altura do badge. Wordmark: BARBOS em Archivo Black, caixa
alta, tracking −1,8%.

### Arquivos

| Arquivo | Uso |
|---|---|
| `logo/barbos-horizontal-claro.png` | Padrão. Fundo claro |
| `logo/barbos-horizontal-escuro.png` | Fundo escuro |
| `logo/barbos-horizontal-mono-grafite.png` | Uma cor, fundo claro |
| `logo/barbos-horizontal-mono-branco.png` | Uma cor, fundo escuro |
| `logo/barbos-vertical-claro.png` / `-escuro.png` | Espaço estreito, selo |
| `logo/barbos-simbolo.png` | Símbolo isolado, 1024px |
| `logo/barbos-simbolo-invertido.png` | Badge grafite, B âmbar — **só sobre fundo claro** |
| `logo/barbos-simbolo-mono-grafite.png` / `-mono-branco.png` | Uma cor |
| `logo/barbos-simbolo-micro.png` | Variante óptica: B a 74%, canto menos redondo |
| `logo/icone-app-512.png`, `icone-app-192.png` | Ícone do app / PWA |
| `logo/favicon-64.png` | Favicon padrão |
| `logo/favicon-48.png`, `favicon-32.png`, `favicon-16.png` | Variante óptica |

### Regras de aplicação

- **Área de respiro:** metade da largura do badge em volta do lockup inteiro.
  Nada entra nessa margem.
- **Tamanho mínimo:** lockup horizontal 120px de largura. Símbolo 24px. Abaixo
  de 32px usar a **variante micro** — o símbolo padrão vira mancha nesse
  tamanho (foi testado).
- `barbos-simbolo-invertido.png` (badge grafite) **desaparece em fundo
  escuro**. Nesse caso usar `barbos-simbolo.png` ou a versão mono branca.

---

## Como construir o sistema com isso

Os tokens estão em dois arquivos, gerados a partir deste manual:

- **`identidade/tokens.css`** — variáveis CSS, tema claro e escuro. Importar
  na raiz do projeto e **nunca escrever hex solto no código**.
- **`identidade/tokens.json`** — mesma paleta em JSON, pra Tailwind config,
  React Native, Figma ou qualquer gerador.

### Ordem de construção recomendada

1. `tokens.css` na raiz do projeto — antes de qualquer componente.
2. Componentes-base nessa ordem: **Botão → Campo → Badge de estado → Card de
   agendamento → Grade da agenda**. Nessa ordem porque cada um usa o anterior.
3. Telas nessa ordem: **Agenda de hoje → Novo agendamento → Cliente →
   Serviços → Estoque → Relatório**. A agenda primeiro porque é a única tela
   que o usuário abre todo dia; se ela não estiver boa, o resto não importa.
4. Tema escuro junto com o claro em cada componente — nunca "depois".

### Regras pro Claude ao escrever código do sistema

- Ler este arquivo antes de qualquer trabalho visual.
- Toda cor sai de `tokens.css`. Hex solto no componente é erro de revisão.
- Todo par texto/fundo novo precisa de 4,5:1 (texto) ou 3:1 (borda e ícone
  de UI). Na dúvida, medir — não estimar no olho.
- Nenhum componente novo abaixo de 44px de alvo de toque.
- Nenhuma tela nova sem estado vazio, estado de carregamento e estado de erro.

---

## Observações adicionais

- Fontes: [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) e
  [Inter](https://fonts.google.com/specimen/Inter), ambas SIL Open Font License.
- Logos geradas por script — `identidade/logo/gerar-logo.py` regenera tudo se
  a marca mudar.
- Manual escrito na primeira sessão de identidade, depois do `/instalar`.
  Atualizar aqui sempre que a marca evoluir; as skills leem esta versão.

---

## Anexo — estados da agenda no tema escuro

Medidos sobre a superfície escura correspondente:

| Estado | Texto | Fundo | Contraste |
|---|---|---|---|
| Agendado | `#9DBBFB` | `#16233D` | 8,15:1 |
| Confirmado | `#6FD3A4` | `#10281E` | 8,58:1 |
| Em atendimento | `#F0A93B` | `#2A2013` | 7,95:1 |
| Concluído | `#A8B0BC` | `#1C2027` | 7,47:1 |
| Não compareceu | `#F5837A` | `#2E1613` | 6,78:1 |
| Cancelado | `#7C8595` | `#1C2027` | tachado |

**Borda de campo no escuro é `graf-400` (`#7C8595`), não `graf-700`.** A borda
escura "elegante" (`#2A2F38` sobre `#14171C`) dá **1,34:1** — o campo some da
tela. Foi medido e corrigido.

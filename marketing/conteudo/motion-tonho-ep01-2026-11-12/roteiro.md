# Na cadeira do Tonho · Ep. 01 · "Sábado, 9h. Dois clientes. Um horário."

Dia 2 do planejamento de 50 dias (motion, pilar A, episódio do Seridó). Rascunho de texto: a voz da marca ainda não
foi definida, então narração e legenda são para revisar.

- **Conceito em uma linha:** o caderno vira tabuleiro: duas peças na mesma casa.
- **Câmera:** grua sobre a mesa. Sempre em plongée, sobe para dar contexto e desce para o detalhe, com foco raso
  (profundidade de campo de verdade, por acúmulo de amostras).
- **Fonte:** Inter (uma só). A "letra de mão" do caderno é a própria Inter inclinada.
- **Cores (tokens do BARBOS):** grafite, âmbar e o azul-700 (capa e tinta). A capa usa azul-700 com 22% de grafite-900.
- **Formato:** 1080 × 1920, 60 qps, 51 s (25,5 compassos de 120 BPM). O último quadro é igual ao primeiro: o Reels gira
  em loop e o primeiro quadro serve de capa.
- **Voz:** Antonio (pt-BR-AntonioNeural, Microsoft), −6% de velocidade.
- **Mapa:** malhas oficiais do IBGE (RN, Seridó Ocidental, Seridó Oriental e o município de Currais Novos).

## Roteiro batida a batida

| Tempo | Fala | Imagem |
|---|---|---|
| 0,0 | (silêncio) | O caderno de capa azul fechado: "Na cadeira do Tonho · Ep. 01". BARBOS embaixo. |
| 0,4 | "Sábado, nove da manhã." | A capa abre. "SÁBADO" no topo da página. No "nove", o 9h levanta em 3D e o marca-texto âmbar corre a linha. |
| 2,5 | "Dois clientes chegam para o mesmo horário." | Dois peões caem do alto na linha das 9h (batidas 3,0 e 3,5), andam em pulinhos e se trombam no "horário" (4,5). |
| 6,0 | "Esse é o Tonho." | A câmera sobe para o cabeçalho: "BARBEARIA DO TONHO". O TONHO levanta do papel. |
| 7,5 | "Barbeiro há quinze anos…" | "HÁ 15 ANOS" sobe atrás dele, com o número contando. |
| 9,0 | "…em Currais Novos, aqui no Seridó." | A grua dispara para cima (potências de dez): o caderno vira um ponto, Currais Novos sobe em âmbar, depois o Seridó, e o RN aparece inteiro. |
| 11,5 | "Duas cadeiras e um caderno de capa azul." | Mergulho de volta ao caderno. Duas cadeiras de barbeiro em miniatura sobem na capa aberta. Órbita mostrando o azul. |
| 15,3 | "Na página de sábado, dois nomes no mesmo horário." | A câmera desce para a página. "Paulo" é escrito à mão na linha das 9h. |
| 19,0 | "Um escrito por cima do outro." | "Diego" por cima, torto, e um rabisco. No "outro", a tinta ganha volume: os nomes levantam e o Diego sobe em cima do Paulo. |
| 21,5 | "Os dois se olham." | Câmera rente ao papel. Os peões se viram um para o outro. |
| 23,3 | "E o Tonho, sem graça, pergunta:" | O foco passa para o fundo: o TONHO sobe meio sem graça e tomba para trás. |
| 26,3 | "Quem marcou primeiro?" | QUEM / MARCOU / PRIMEIRO? sobem em branco, uma palavra por vez. |
| 28,3 | "Ninguém sabe." | A pergunta afunda. Os peões olham para a câmera e dão de ombros. |
| 29,8 | "Um deles vai embora." | O Diego cai da pilha. Um peão vira de costas e vai embora em pulinhos, cai da página e some no escuro. |
| 31,8 | "Menos um corte." | "−1 CORTE" cai do alto e bate na batida de 32,5. |
| 33,3 | "E, talvez, menos um cliente." | Na capa, uma das cadeiras vira de costas e afunda. |
| 37,0 | "O problema não é o Tonho." | Vista de cima. O TONHO levanta e é tirado da página. |
| 39,0 | "É o caderno." | Tudo afunda e o caderno fecha com força (39,5). |
| 41,0 | "Se isso já aconteceu com você, comenta: já." | Na capa: JÁ ACONTECEU / COM VOCÊ?, palavra por palavra. No "comenta", sobe um balão âmbar com "JÁ". |
| 45,3 | "Na cadeira do Tonho. Toda semana tem episódio." | O título sobe da capa, a cadeira do Tonho aparece e o selo "EP. 01" carimba em 48,5. A grua volta ao primeiro quadro e o BARBOS aparece. |

## Como refazer

```
python preparar.py <Inter-VF.ttf> <pasta com os GeoJSON do IBGE>   # fonte 3D e mapa (já feito)
cd narracao && python narracao.py gerar && python narracao.py montar # voz e grade
node render.mjs batidas 4        # um quadro por batida, para revisar (python folha.py _batidas _folha 8)
node render.mjs trilha           # trilha.wav
node render.mjs video 10         # quadros finais
powershell -File encode.ps1      # instagram/motion-tonho-ep01.mp4 (antes, gere o audio_final.wav: ver Mixagem)
```

## Mixagem

```
ffmpeg -i narracao/voz.wav -i trilha.wav -filter_complex "[1:a]loudnorm=I=-24:TP=-3:LRA=9[t];[0:a]asplit=2[v][sc];[t][sc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350:makeup=1[td];[v][td]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" -map "[a]" -ar 48000 -ac 2 audio_final.wav
```

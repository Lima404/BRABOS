# Na cadeira do Tonho · Ep. 02 · "O WhatsApp não para"

Dia 4 do planejamento de 50 dias (motion, pilar A, capítulo 1 "O caderno"). Rascunho de texto: a voz da marca ainda
não foi definida, então narração e legenda são para revisar.

- **Conceito em uma linha:** mensagem sem resposta vira bloco na mesa. A pilha cresce enquanto a mão do Tonho está ocupada.
- **Câmera:** a grua do Ep. 01. Sempre em plongée sobre o balcão, sobe para dar contexto e desce para o detalhe, com foco
  raso (profundidade de campo de verdade, por acúmulo de amostras). Duas trocas de foco levam o olho para o Tonho
  trabalhando no fundo: no "O Tonho só consegue responder" e no "trabalhando".
- **Mesa:** o caderno de capa azul no centro (abre e fecha o vídeo), o celular a leste, o salão (cadeira, cliente e o
  TONHO) ao norte do celular, e o relógio e a conversa ao sul. Com a câmera baixa olhando para o norte, o Tonho fica no
  fundo de tudo o que acontece com o celular.
- **Fonte:** Inter (uma só).
- **Cores (tokens do BARBOS):** grafite, âmbar e o azul-700 do caderno. Âmbar só no que é ação ou destaque: o contador,
  a resposta "Tenho às 15h!", o 14:40, o risco no RUIM, o TRABALHANDO, o horário marcado e o balão da chamada.
- **Formato:** 1080 × 1920, 60 qps, 43 s (21,5 compassos de 120 BPM). O último quadro é igual ao primeiro: o Reels gira
  em loop e o primeiro quadro serve de capa.
- **Voz:** Antonio (pt-BR-AntonioNeural, Microsoft), −6%, **numa tomada só** (regra da casa desde 15/11): o texto inteiro
  é lido de uma vez e só os silêncios mudam de tamanho, para cada frase começar na grade de 1/4 de batida.
  Gerada pelo Edge TTS = **rascunho** (ver "Antes de publicar").

## Roteiro batida a batida

| Tempo | Fala | Imagem |
|---|---|---|
| 0,0 | (silêncio) | O caderno de capa azul fechado: "Na cadeira do Tonho · Ep. 02". BARBOS embaixo. |
| 0,35 | "Tesoura numa mão." | O rótulo afunda na capa e TESOURA sobe de pé. A grua desce. |
| 1,9 | "Celular na outra." | CELULAR sobe ao lado. No "outra", a palavra vibra. |
| 3,5 | — | As duas palavras tombam para trás na batida e afundam. A grua voa para o norte. |
| 3,9 | "O Tonho está cortando," | A cadeira sobe do balcão, o TONHO sobe ao lado e o cliente cai na cadeira (4,5). O TONHO balança no ritmo do corte até o fim do salão. |
| 5,5 | "e o celular não para." | A câmera desce para o celular, que acende e vibra duas vezes. |
| 7,25 | "Três mensagens." | Três balões caem em cima do celular, um sobre o outro. O contador âmbar sobe: 1, 2, 3. |
| 8,9 | "Sete." | Mais quatro balões. O contador chega a 7 no instante da palavra. |
| 9,9 | "Doze." | Mais cinco. 12. A grua baixa e a pilha vira uma torre na frente do Tonho. |
| 11,25 | "Onze e dois:" | 11:02 sobe em números de pé na frente do celular. |
| 12,3 | "tem horário hoje à tarde?" | A primeira mensagem escorrega de baixo da pilha (a torre desce um andar), pula para o balcão e cresce: "Tem horário hoje à tarde? 11:02". |
| 14,6 | "O Tonho só consegue responder às duas e quarenta." | O relógio corre de 11:02 a 14:40, a sombra gira com o sol da tarde e o foco passa para o Tonho cortando no fundo. O 14:40 bate na batida de 17,0 e fica âmbar. |
| 18,1 | "Tenho às três!" | A resposta âmbar sai da tela do celular e pousa ao lado da pergunta: "Tenho às 15h! 14:40". |
| 19,6 | "Já cortei, obrigado." | O balão branco cai do alto embaixo dela: "Já cortei, obrigado. 14:41". O celular vibra. |
| 21,0 | — | **O momento mais forte:** a torre de mensagens desaba pelo balcão, a resposta âmbar murcha e o contador some. |
| 22,1 | "Ele não perdeu o cliente por ser ruim." | A grua desce até o chão. RUIM sobe de pé e um risco âmbar corta a palavra. |
| 24,6 | "Perdeu por estar trabalhando." | RUIM afunda e TRABALHANDO sobe em âmbar no lugar. O foco passa para o Tonho no fundo, ainda cortando. |
| 27,1 | "E se o cliente pudesse ver os horários livres, sem precisar perguntar?" | Um cliente (peão claro) cai no balcão e olha. Os horários sobem como peças: 14h e 17h ocupados, 15h e 16h acendem LIVRE. No "sem precisar perguntar", ele pula até o 15h, que vira âmbar: MARCADO. |
| 32,4 | "Quantas vezes por dia te perguntam se tem horário?" | A grua volta ao caderno. QUANTAS / POR DIA? sobem em relevo na capa. |
| 35,6 | "Comenta o número." | Sobe o balão âmbar. No "número", o "?" aparece dentro dele. |
| 37,5 | "Na cadeira do Tonho. Até o próximo episódio." | O título sobe da capa, a cadeira aparece e o selo "EP. 02" carimba em 40,5. A grua volta ao primeiro quadro e o BARBOS aparece. |

Nomes, mensagens e horários são de exemplo. O Tonho é personagem.

## Antes de publicar

- **Voz:** foi gerada pelo Edge TTS, que é a mesma voz da Azure, mas os termos do Edge não cobrem uso comercial com
  clareza. Para publicar, gere a mesma tomada pela Azure (com `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` configuradas no
  seu computador) e rode `montar` de novo. A cena se ajusta sozinha ao tempo das palavras.
- Leia a narração em voz alta e troque o que não soar como você (é rascunho).

## Como refazer

```
cd narracao && python narracao.py gerar && python narracao.py montar   # voz numa tomada só e grade
node render.mjs batidas 4        # um quadro por batida, para revisar (python folha.py _batidas _folha 8)
node render.mjs trilha           # trilha.wav
node render.mjs video 10         # quadros finais (_sub/)
powershell -File encode.ps1      # instagram/motion-tonho-ep02.mp4 (antes, gere o audio_final.wav: ver Mixagem)
```

O motor (`nucleo.js`, `render.mjs`, `folha.py`) é o do Ep. 01, com o âmbar-800 acrescentado à paleta.

## Mixagem

```
ffmpeg -i narracao/voz.wav -i trilha.wav -filter_complex "[1:a]loudnorm=I=-24:TP=-3:LRA=9[t];[0:a]asplit=2[v][sc];[t][sc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350:makeup=1[td];[v][td]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" -map "[a]" -ar 48000 -ac 2 audio_final.wav
```

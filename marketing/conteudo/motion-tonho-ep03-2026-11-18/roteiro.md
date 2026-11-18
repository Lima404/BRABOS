# Na cadeira do Tonho · Ep. 03 · "O cliente que furou"

Dia 6 do planejamento de 50 dias (motion, pilar A, capítulo 1 "O caderno"). Rascunho de texto: a voz da marca ainda
não foi definida, então narração e legenda são para revisar.

- **Conceito em uma linha:** o tempo perdido vira coisa na mesa. Um relógio grande deitado no balcão, com a cadeira vazia
  no centro, pinta de âmbar os minutos sem cliente; esse pedaço de 40 minutos levanta e vira o mês.
- **Câmera:** a grua da série. Plongée sobre o balcão, sobe para dar contexto e desce para o detalhe, com foco raso.
- **Mesa:** o caderno de capa azul no centro (abre na página de TERÇA e fecha no fim), o salão a leste (o relógio deitado,
  a cadeira com a plaquinha "16h · Damião", a porta ao norte e o TONHO na frente) e o mês ao sul do salão.
- **Fonte:** Inter (uma só). A letra de mão do caderno é a própria Inter inclinada.
- **Cores (tokens do BARBOS):** grafite, âmbar e o azul-700 do caderno. Âmbar só no tempo perdido (o setor do relógio, o
  pedaço de 40 min, os 26 dias, o 17h20), no 16:40, no "telefone?", no ícone de ligar e no balão da chamada.
- **Formato:** 1080 × 1920, 60 qps, 47 s (23,5 compassos de 120 BPM). O último quadro é igual ao primeiro (loop e capa).
- **Voz:** Antonio (pt-BR-AntonioNeural), −6%, numa tomada só, com as frases na grade de 1/4 de batida.
  Gerada pelo Edge TTS = **rascunho** (ver "Antes de publicar").

## Roteiro batida a batida

| Tempo | Fala | Imagem |
|---|---|---|
| 0,0 | (silêncio) | O caderno de capa azul fechado: "Na cadeira do Tonho · Ep. 03". BARBOS embaixo. |
| 0,35 | "Terça, quatro da tarde." | A capa abre na página de TERÇA. No "quatro", o 16h levanta da página e o marca-texto corre a linha: "Damião". |
| 2,5 | "A cadeira está pronta." | A grua voa para o salão. A cadeira sobe no centro do relógio deitado, com a plaquinha "16h · Damião" no assento. 16:00 sobe na frente. |
| 4,1 | "O cliente não veio." | A câmera chega na porta. Vazia. |
| 6,25 | "Quatro e quinze." | Vista de cima: o ponteiro corre 15 minutos e o setor âmbar pinta o relógio. 16:15. |
| 7,6 | "Quatro e meia, e o Tonho de olho na porta." | Mais 15 minutos (meio relógio âmbar), 16:30. O TONHO sobe na frente e vira para a porta. |
| 11,1 | "Ele procura o telefone no caderno." | A grua volta ao caderno. O marca-texto varre a linha das 16h, procurando. |
| 13,5 | "Só tem escrito: Damião." | O nome sai do papel e fica de pé. Ao lado, onde deveria estar o número, um quadrado tracejado: "telefone?". |
| 16,1 | "Sem telefone. Sem aviso. Sem como remarcar." | Uma frase por batida, de pé nas linhas de baixo: SEM TELEFONE / SEM AVISO / SEM COMO REMARCAR. |
| 20,9 | "Quatro e quarenta, chega outro cliente querendo encaixe." | De volta ao salão: mais 10 minutos, 16:40 em âmbar. Um cliente (peão claro) entra pela porta, a plaquinha cai e ele pula para a cadeira. |
| 24,75 | "Mas quarenta minutos já foram." | O pedaço âmbar de 40 minutos ganha volume, levanta do relógio e vem para a frente: "40 MIN". |
| 27,5 | "Um furo por dia, no fim do mês, vira mais de dezessete horas de cadeira parada." | O pedaço encolhe e vira o primeiro dia de um calendário (SEG a SÁB); os outros 25 caem em cascata. "EXEMPLO: 40 MIN POR DIA, 26 DIAS". No "vira", os 26 se juntam e **17h20** sobe de pé (31,0, o impacto forte): DE CADEIRA PARADA. |
| 33,75 | "Agenda boa guarda o telefone de quem marcou." | De volta à página: um cartão sobe na linha das 16h. "16:00 · Damião", e no "telefone" aparece o número e o botão de ligar. |
| 37,4 | "E você, como lida com quem fura?" | O caderno fecha batendo (37,0). Na capa, em relevo: COMO VOCÊ LIDA / COM QUEM FURA? |
| 40,25 | "Conta aqui." | Sobe o balão âmbar com os três pontinhos de "digitando". |
| 41,75 | "Na cadeira do Tonho. Toda semana tem episódio." | O título sobe da capa, a cadeira aparece e o selo "EP. 03" carimba em 45,0. A grua volta ao primeiro quadro e o BARBOS aparece. |

Nomes, horários e o telefone (mascarado) são de exemplo. A conta do mês leva "EXEMPLO" escrito na tela, como pede o
planejamento: 40 min × 26 dias = 1.040 min = 17h20. O Tonho é personagem.

## Antes de publicar

- **Voz:** gerada pelo Edge TTS (a mesma voz da Azure, mas os termos do Edge não cobrem uso comercial com clareza). Para
  publicar, gere a mesma tomada pela Azure (com `AZURE_SPEECH_KEY` e `AZURE_SPEECH_REGION` no seu computador) e rode
  `montar` de novo. A cena se ajusta sozinha ao tempo das palavras.
- Leia a narração em voz alta e troque o que não soar como você (é rascunho).

## Como refazer

```
cd narracao && python narracao.py gerar && python narracao.py montar   # voz numa tomada só e grade
node render.mjs batidas 4        # um quadro por batida, para revisar (python folha.py _batidas _folha 8)
node render.mjs trilha           # trilha.wav
node render.mjs video 10         # quadros finais (_sub/)
powershell -File encode.ps1      # instagram/motion-tonho-ep03.mp4 (antes, gere o audio_final.wav: ver Mixagem)
```

## Mixagem

```
ffmpeg -i narracao/voz.wav -i trilha.wav -filter_complex "[1:a]loudnorm=I=-24:TP=-3:LRA=9[t];[0:a]asplit=2[v][sc];[t][sc]sidechaincompress=threshold=0.04:ratio=5:attack=15:release=350:makeup=1[td];[v][td]amix=inputs=2:duration=first:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]" -map "[a]" -ar 48000 -ac 2 audio_final.wav
```

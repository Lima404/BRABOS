#!/usr/bin/env bash
#
# Prepara o vídeo de fundo do herói (components/secoes/heroi.tsx).
#
# Entrada: o vídeo de 5s do Higgsfield — a barbearia à noite com a câmera
# avançando devagar até a cadeira (Kling 3.0 Turbo, 1080p, a partir de uma
# imagem gerada antes).
#
#   ./scripts/cena-do-heroi.sh caminho/da/cena.mp4
#
# Saída, em public/heroi/:
#   cena.mp4   H.264, 1600px, ~700 KB — toca em qualquer navegador
#   cena.webm  VP9, ~330 KB — o navegador escolhe este quando consegue
#   cena.webp  o primeiro quadro: pôster do vídeo, imagem de quem pediu
#              menos movimento e imagem da prévia do link (Open Graph)
#
# O vídeo vira um vai-e-volta de 10s: os 5s para frente e os mesmos 5s de
# trás para frente. Assim o `loop` do <video> não tem costura — o último
# quadro é igual ao primeiro. O quadro repetido no meio é cortado para a
# câmera não "parar" por um instante na virada.
set -euo pipefail

VIDEO="${1:?uso: $0 <cena.mp4>}"
DESTINO="$(dirname "$0")/../public/heroi"
mkdir -p "$DESTINO"

ffmpeg -y -loglevel error -i "$VIDEO" \
  -filter_complex "[0:v]scale=1600:-2:flags=lanczos,setsar=1,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a]trim=end_frame=120,setpts=PTS-STARTPTS[f];[f][r]concat=n=2:v=1,format=yuv420p[v]" \
  -map "[v]" -an -c:v libx264 -preset slow -crf 27 -profile:v high \
  -movflags +faststart "$DESTINO/cena.mp4"

ffmpeg -y -loglevel error -i "$DESTINO/cena.mp4" -an \
  -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 -deadline good -cpu-used 4 \
  "$DESTINO/cena.webm"

ffmpeg -y -loglevel error -i "$VIDEO" -vf "scale=1600:-1" -frames:v 1 \
  -c:v libwebp -quality 80 "$DESTINO/cena.webp"

ls -la "$DESTINO"

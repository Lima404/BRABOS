#!/usr/bin/env bash
#
# Recorta o giro da cadeira em quadros para o herói.
#
# Entrada: um vídeo de 5s, 24 quadros por segundo, com a cadeira girando
# sobre o fundo escuro — gerado no Higgsfield a partir de uma foto da
# cadeira já montada no palco (ver README.md).
#
#   ./scripts/quadros-da-cadeira.sh caminho/do/giro.mp4
#
# Saída: public/cadeira/q001.webp ... — um quadro sim, um não, recortados
# no quadrado do centro e reduzidos a 820px. Dá 61 arquivos, ~1,3 MB no
# total, uns 22 KB cada.
#
# Se o número de quadros mudar, `QUADROS` em components/secoes/heroi.tsx
# tem que mudar junto.
set -euo pipefail

VIDEO="${1:?uso: $0 <video.mp4>}"
DESTINO="$(dirname "$0")/../public/cadeira"

mkdir -p "$DESTINO"
rm -f "$DESTINO"/*.webp

ffmpeg -y -loglevel error -i "$VIDEO" \
  -vf "select='not(mod(n\,2))',crop=1248:1248:208:0,scale=820:820:flags=lanczos" \
  -fps_mode passthrough -f image2 -c:v libwebp -quality 78 -compression_level 6 \
  "$DESTINO/q%03d.webp"

echo "quadros: $(ls "$DESTINO" | wc -l)"
du -sh "$DESTINO"

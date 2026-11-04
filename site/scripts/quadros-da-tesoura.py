"""
Recorta a tesoura em quadros com fundo transparente, para o capítulo do
caderno (components/secoes/caderno.tsx).

Entrada: o vídeo de 5s do Higgsfield — a tesoura parada no centro, de
perfil, sobre preto puro, abrindo e fechando (Kling 3.0 Turbo, 1080p, a
partir de uma foto da tesoura gerada antes).

    python scripts/quadros-da-tesoura.py caminho/da/tesoura.mp4

Saída: public/tesoura/t01.webp ... t25.webp — 640px de largura, ~23 KB
cada, ~570 KB no total.

O que ele faz:

1. Extrai os quadros do vídeo com o ffmpeg (precisa estar no PATH).
2. Fica só com UM ciclo limpo de corte: do quadro 36 (fechada) ao 60
   (fechada de novo), passando pelo 45 (aberta). O site repete esse ciclo
   enquanto a tesoura atravessa o caderno. Se o vídeo for refeito, estes
   números mudam — conferir medindo a abertura das lâminas quadro a quadro.
3. Tira o preto do fundo. Não é chroma key: o alfa sai do brilho do pixel,
   com uma rampa suave na borda, e um "fechamento" (dilata e erode 3px)
   preenche as partes escuras do próprio aço, que senão ficariam
   transparentes. Os furos dos aros continuam vazados, porque são grandes
   demais para o fechamento tapar.
4. Corta todos os quadros na mesma caixa — a união da tesoura em todos
   eles — para ela não pular de lugar entre um quadro e outro.

Precisa de Pillow e numpy.
"""

import glob
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageFilter

PRIMEIRO, ULTIMO = 36, 60
LARGURA = 640
RAIO_FECHAMENTO = 3


def dilata(mascara, raio):
    saida = mascara.copy()
    for dy in range(-raio, raio + 1):
        for dx in range(-raio, raio + 1):
            saida = np.maximum(saida, np.roll(np.roll(mascara, dy, 0), dx, 1))
    return saida


def erode(mascara, raio):
    saida = mascara.copy()
    for dy in range(-raio, raio + 1):
        for dx in range(-raio, raio + 1):
            saida = np.minimum(saida, np.roll(np.roll(mascara, dy, 0), dx, 1))
    return saida


def main():
    if len(sys.argv) != 2:
        sys.exit("uso: python scripts/quadros-da-tesoura.py <tesoura.mp4>")

    video = sys.argv[1]
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    destino = os.path.join(raiz, "public", "tesoura")
    os.makedirs(destino, exist_ok=True)
    for antigo in glob.glob(os.path.join(destino, "*.webp")):
        os.remove(antigo)

    with tempfile.TemporaryDirectory() as pasta:
        subprocess.run(
            ["ffmpeg", "-v", "error", "-y", "-i", video, "-vf", "scale=962:-2",
             os.path.join(pasta, "f%03d.png")],
            check=True,
        )
        quadros = [
            np.asarray(Image.open(os.path.join(pasta, f"f{n:03d}.png")).convert("RGB")).astype(np.float32)
            for n in range(PRIMEIRO, ULTIMO + 1)
        ]

    # A caixa que cobre a tesoura em todos os quadros, com 10px de folga.
    x0, x1, y0, y1 = 10**9, 0, 10**9, 0
    for quadro in quadros:
        ys, xs = np.where(quadro.mean(axis=2) > 14)
        x0, x1 = min(x0, xs.min()), max(x1, xs.max())
        y0, y1 = min(y0, ys.min()), max(y1, ys.max())
    x0, y0, x1, y1 = x0 - 10, y0 - 10, x1 + 10, y1 + 10

    altura = 0
    for k, quadro in enumerate(quadros):
        quadro = quadro[y0:y1, x0:x1]
        brilho = quadro.max(axis=2)
        suave = np.clip((brilho - 7) / 22, 0, 1)
        forte = (brilho > 18).astype(np.float32)
        fechado = erode(dilata(forte, RAIO_FECHAMENTO), RAIO_FECHAMENTO)
        alfa = np.maximum(suave, fechado)

        imagem = Image.fromarray(np.clip(quadro, 0, 255).astype(np.uint8)).convert("RGBA")
        imagem.putalpha(
            Image.fromarray((alfa * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
        )
        altura = round(imagem.height * LARGURA / imagem.width)
        imagem = imagem.resize((LARGURA, altura), Image.LANCZOS)
        imagem.save(os.path.join(destino, f"t{k + 1:02d}.webp"), "WEBP", quality=82, method=6)

    print(f"quadros: {len(quadros)}  tamanho: {LARGURA}x{altura}")
    print("se o número de quadros mudar, QUADROS_DA_TESOURA em caderno.tsx muda junto")


if __name__ == "__main__":
    main()

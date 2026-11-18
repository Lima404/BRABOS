"""Monta folhas de revisão com os quadros de uma pasta (q_<n>_<segundos>.jpg), com o tempo e o compasso em cima.

  python folha.py _batidas _folha 8        (8 colunas, várias folhas de até 32 quadros)
"""
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

pasta, saida = Path(sys.argv[1]), sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
por_folha = int(sys.argv[4]) if len(sys.argv) > 4 else 32
larg = 240
alt = int(larg * 1920 / 1080)
arqs = sorted(pasta.glob("q_*.jpg"))
try:
    f = ImageFont.truetype("arial.ttf", 17)
except OSError:
    f = ImageFont.load_default()
for n0 in range(0, len(arqs), por_folha):
    lote = arqs[n0:n0 + por_folha]
    linhas = (len(lote) + cols - 1) // cols
    folha = Image.new("RGB", (cols * larg, linhas * (alt + 24)), (40, 40, 40))
    d = ImageDraw.Draw(folha)
    for i, a in enumerate(lote):
        im = Image.open(a).resize((larg, alt), Image.LANCZOS)
        x, y = (i % cols) * larg, (i // cols) * (alt + 24)
        folha.paste(im, (x, y + 24))
        t = float(a.stem.split("_")[2])
        c, b = int(t // 2) + 1, int((t % 2) / 0.5) + 1
        d.text((x + 4, y + 3), f"{t:5.2f}s  c{c}.{b}", fill=(255, 255, 255), font=f)
    arq = f"{saida}_{n0 // por_folha}.jpg"
    folha.save(arq, quality=86)
    print(arq, folha.size)

# -*- coding: utf-8 -*-
"""
Gerador da identidade BARBOS.

Regenera toda a biblioteca de logos a partir do codigo. Se a marca mudar,
edite as constantes no topo e rode de novo — nao edite PNG na mao.

    python identidade/logo/gerar-logo.py

Requer: Pillow. Baixa Archivo Black do Google Fonts na primeira execucao.
Especificacao completa em identidade/design-guide.md.
"""
import os
import math
import urllib.request

from PIL import Image, ImageDraw, ImageFont

AQUI = os.path.dirname(os.path.abspath(__file__))
IDENTIDADE = os.path.dirname(AQUI)
ARCHIVO = os.path.join(AQUI, "ArchivoBlack-Regular.ttf")
FONTE_URL = ("https://github.com/google/fonts/raw/main/ofl/"
             "archivoblack/ArchivoBlack-Regular.ttf")

AMBAR = (240, 169, 59, 255)     # ambar-500 #F0A93B
GRAFITE = (20, 23, 28, 255)     # graf-900  #14171C
BRANCO = (255, 255, 255, 255)
TRANSP = (0, 0, 0, 0)

SS = 4          # supersampling
N_SQUIRCLE = 4.5   # expoente da superelipse
RATIO_B = 0.54     # altura do "B" em relacao ao badge
RATIO_B_MICRO = 0.74   # variante otica para 32px ou menos
TRACK_EM = -0.018      # tracking do wordmark


def garantir_fonte():
    if not os.path.exists(ARCHIVO):
        print("baixando Archivo Black...")
        urllib.request.urlretrieve(FONTE_URL, ARCHIVO)
    return ARCHIVO


def squircle(size, color, n=N_SQUIRCLE, steps=1440):
    """Superelipse |x|^n + |y|^n = 1, desenhada com supersampling."""
    S = size * SS
    img = Image.new("RGBA", (S, S), TRANSP)
    d = ImageDraw.Draw(img)
    a = S / 2.0
    pts = []
    for i in range(steps):
        t = 2 * math.pi * i / steps
        ct, st = math.cos(t), math.sin(t)
        x = a * math.copysign(abs(ct) ** (2.0 / n), ct)
        y = a * math.copysign(abs(st) ** (2.0 / n), st)
        pts.append((a + x, a + y))
    d.polygon(pts, fill=color)
    return img.resize((size, size), Image.LANCZOS)


def ink(font, text, tracking=0.0):
    """Caixa de tinta real: ignora side bearing e altura de linha."""
    tmp = Image.new("L", (10, 10))
    dd = ImageDraw.Draw(tmp)
    if tracking == 0:
        return dd.textbbox((0, 0), text, font=font)
    x, boxes = 0.0, []
    for ch in text:
        b = dd.textbbox((x, 0), ch, font=font)
        if b[2] > b[0]:
            boxes.append(b)
        x += font.getlength(ch) + tracking
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def _tracked(draw, xy, text, font, fill, tracking=0.0):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def wordmark(cap_h, color, text="BARBOS"):
    """Wordmark recortado exatamente na altura de caixa alta pedida."""
    px = int(cap_h * SS * 1.45)
    f = ImageFont.truetype(ARCHIVO, px)
    tr = TRACK_EM * px
    bb = ink(f, text, tr)
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    img = Image.new("RGBA", (int(w) + 4, int(h) + 4), TRANSP)
    _tracked(ImageDraw.Draw(img), (2 - bb[0], 2 - bb[1]), text, f, color, tr)
    img = img.crop(img.getbbox())
    escala = (cap_h * SS) / img.height
    largura = max(1, round(img.width * escala))
    return (img.resize((largura, cap_h * SS), Image.LANCZOS)
               .resize((max(1, round(largura / SS)), cap_h), Image.LANCZOS))


def simbolo(size, bg=AMBAR, letra=GRAFITE, ratio=RATIO_B, n=N_SQUIRCLE):
    """Squircle + B centralizado pela tinta (nao pela metrica da fonte)."""
    badge = squircle(size, bg, n=n)
    S = size * SS
    layer = Image.new("RGBA", (S, S), TRANSP)
    d = ImageDraw.Draw(layer)
    px = int(S * 0.8)
    f = ImageFont.truetype(ARCHIVO, px)
    h = ink(f, "B")[3] - ink(f, "B")[1]
    f = ImageFont.truetype(ARCHIVO, int(px * (S * ratio) / h))
    bb = ink(f, "B")
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    d.text(((S - w) / 2 - bb[0], (S - h) / 2 - bb[1]), "B", font=f, fill=letra)
    badge.alpha_composite(layer.resize((size, size), Image.LANCZOS))
    return badge


def simbolo_micro(size):
    """Abaixo de 32px o simbolo padrao vira mancha. Esta variante nao."""
    return simbolo(size, ratio=RATIO_B_MICRO, n=5.0)


def lockup_h(badge_px, sym_bg, sym_fg, word_color, gap=0.26, cap=0.50):
    sym = simbolo(badge_px, sym_bg, sym_fg)
    wm = wordmark(int(badge_px * cap), word_color)
    g = int(badge_px * gap)
    img = Image.new("RGBA", (badge_px + g + wm.width, badge_px), TRANSP)
    img.alpha_composite(sym, (0, 0))
    img.alpha_composite(wm, (badge_px + g, (badge_px - wm.height) // 2))
    return img


def lockup_v(badge_px, sym_bg, sym_fg, word_color, gap=0.24, cap=0.34):
    sym = simbolo(badge_px, sym_bg, sym_fg)
    wm = wordmark(int(badge_px * cap), word_color)
    g = int(badge_px * gap)
    W = max(badge_px, wm.width)
    img = Image.new("RGBA", (W, badge_px + g + wm.height), TRANSP)
    img.alpha_composite(sym, ((W - badge_px) // 2, 0))
    img.alpha_composite(wm, ((W - wm.width) // 2, badge_px + g))
    return img


def salvar(img, nome, pasta=AQUI):
    caminho = os.path.join(pasta, nome)
    img.save(caminho)
    print(f"  {nome:42s} {img.width}x{img.height}")


def main():
    garantir_fonte()

    print("simbolo / icone")
    salvar(simbolo(1024), "barbos-simbolo.png")
    salvar(simbolo(512), "icone-app-512.png")
    salvar(simbolo(192), "icone-app-192.png")
    salvar(simbolo(64), "favicon-64.png")
    salvar(simbolo(1024, GRAFITE, AMBAR), "barbos-simbolo-invertido.png")
    salvar(simbolo(1024, GRAFITE, BRANCO), "barbos-simbolo-mono-grafite.png")
    salvar(simbolo(1024, BRANCO, GRAFITE), "barbos-simbolo-mono-branco.png")

    print("variante otica (32px ou menos)")
    salvar(simbolo_micro(1024), "barbos-simbolo-micro.png")
    for px in (48, 32, 16):
        salvar(simbolo_micro(px), f"favicon-{px}.png")

    print("wordmark")
    salvar(wordmark(320, GRAFITE), "barbos-wordmark-grafite.png")
    salvar(wordmark(320, BRANCO), "barbos-wordmark-branco.png")
    salvar(wordmark(320, AMBAR), "barbos-wordmark-ambar.png")

    print("lockup horizontal")
    salvar(lockup_h(400, AMBAR, GRAFITE, GRAFITE), "barbos-horizontal-claro.png")
    salvar(lockup_h(400, AMBAR, GRAFITE, BRANCO), "barbos-horizontal-escuro.png")
    salvar(lockup_h(400, GRAFITE, BRANCO, GRAFITE), "barbos-horizontal-mono-grafite.png")
    salvar(lockup_h(400, BRANCO, GRAFITE, BRANCO), "barbos-horizontal-mono-branco.png")

    print("lockup vertical")
    salvar(lockup_v(400, AMBAR, GRAFITE, GRAFITE), "barbos-vertical-claro.png")
    salvar(lockup_v(400, AMBAR, GRAFITE, BRANCO), "barbos-vertical-escuro.png")

    print("atalhos lidos pelas skills do MazyOS")
    salvar(lockup_h(400, AMBAR, GRAFITE, GRAFITE), "logo.png", IDENTIDADE)
    salvar(lockup_h(400, AMBAR, GRAFITE, BRANCO), "logo-branco.png", IDENTIDADE)


if __name__ == "__main__":
    main()

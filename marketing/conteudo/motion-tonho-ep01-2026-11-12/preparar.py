"""Prepara os insumos do motion (roda uma vez):

  python preparar.py <Inter-VF.ttf> <pasta com os GeoJSON do IBGE>

- assets/Inter-VF.ttf                  a fonte variável, para as texturas de canvas (página, capa)
- assets/inter_<peso>.typeface.json    contornos da Inter em peso fixo, para as letras com volume (TextGeometry)
- assets/mapa.json                     RN, Seridó Ocidental, Seridó Oriental e Currais Novos (malhas do IBGE),
                                       projetados em unidades da cena (5 por km), com a cidade de Currais Novos na
                                       origem: x = leste, z = sul (o norte fica para cima na tela)
"""
import json
import math
import shutil
import sys
from pathlib import Path

from fontTools.pens.basePen import BasePen
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

AQUI = Path(__file__).parent
ASSETS = AQUI / "assets"
CHARS = ("ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
         "áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ .,;:!?·-−'\"%()/&+")


class Contorno(BasePen):
    def __init__(self, gs):
        super().__init__(gs)
        self.cmd = []

    def _moveTo(self, p):
        self.cmd += ["m", round(p[0]), round(p[1])]

    def _lineTo(self, p):
        self.cmd += ["l", round(p[0]), round(p[1])]

    def _qCurveToOne(self, c, p):
        self.cmd += ["q", round(p[0]), round(p[1]), round(c[0]), round(c[1])]

    def _curveToOne(self, c1, c2, p):
        self.cmd += ["b", round(p[0]), round(p[1]), round(c1[0]), round(c1[1]), round(c2[0]), round(c2[1])]


def fonte(vf: Path, peso: int):
    f = instancer.instantiateVariableFont(TTFont(vf), {"wght": peso, "opsz": 32})
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    glyphs = {}
    for ch in CHARS:
        nome = cmap.get(ord(ch))
        if not nome:
            print("  sem glifo:", repr(ch))
            continue
        pen = Contorno(gs)
        gs[nome].draw(pen)
        adv = hmtx[nome][0]
        glyphs[ch] = {"ha": adv, "x_min": 0, "x_max": adv, "o": " ".join(str(v) for v in pen.cmd)}
    head = f["head"]
    dados = {"glyphs": glyphs, "familyName": "Inter", "ascender": f["hhea"].ascent, "descender": f["hhea"].descent,
             "underlinePosition": f["post"].underlinePosition, "underlineThickness": f["post"].underlineThickness,
             "boundingBox": {"xMin": head.xMin, "yMin": head.yMin, "xMax": head.xMax, "yMax": head.yMax},
             "resolution": head.unitsPerEm,
             "original_font_information": {"format": 0, "fontFamily": "Inter", "fontWeight": str(peso)},
             "cssFontWeight": "normal", "cssFontStyle": "normal"}
    (ASSETS / f"inter_{peso}.typeface.json").write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    print(f"inter_{peso}.typeface.json", len(glyphs), "glifos")


# cidade de Currais Novos (6°15′S, 36°31′W): a origem da cena
LAT0, LON0 = -6.2617, -36.5178
K = 5.0   # unidades da cena por km


def projetar(lon, lat):
    x = (lon - LON0) * 111.32 * math.cos(math.radians(LAT0)) * K
    z = -(lat - LAT0) * 110.57 * K
    return [round(x, 2), round(z, 2)]


def anel(geo):
    g = geo["features"][0]["geometry"]
    polis = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    maior = max(polis, key=lambda p: len(p[0]))      # o polígono principal, só o anel externo
    return [projetar(lon, lat) for lon, lat in maior[0]]


def dentro(p, anel_):
    x, z = p
    d = False
    for (x1, z1), (x2, z2) in zip(anel_, anel_[1:] + anel_[:1]):
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            d = not d
    return d


def mapa(pasta: Path):
    ler = lambda n: json.loads((pasta / n).read_text(encoding="utf-8"))
    m = {"k": K, "rn": anel(ler("rn.json")), "serido_oc": anel(ler("serido_oc.json")),
         "serido_or": anel(ler("serido_or.json")), "currais": anel(ler("currais.json"))}
    assert dentro([0, 0], m["currais"]), "a cidade precisa cair dentro do município"
    for n in ("rn", "serido_oc", "serido_or", "currais"):
        xs, zs = [p[0] for p in m[n]], [p[1] for p in m[n]]
        print(f"{n:10s} {len(m[n]):4d} pontos  x {min(xs):8.1f}..{max(xs):8.1f}  z {min(zs):8.1f}..{max(zs):8.1f}")
    (ASSETS / "mapa.json").write_text(json.dumps(m), encoding="utf-8")


if __name__ == "__main__":
    ASSETS.mkdir(exist_ok=True)
    vf = Path(sys.argv[1])
    shutil.copy(vf, ASSETS / "Inter-VF.ttf")
    for p in (800, 600):
        fonte(vf, p)
    mapa(Path(sys.argv[2]))

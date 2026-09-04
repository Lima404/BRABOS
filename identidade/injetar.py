# -*- coding: utf-8 -*-
import base64, io, os, sys
from PIL import Image
sys.path.insert(0, r"c:/Users/Cliente/Documents/Gabriel/BARBOS/MazyOS/identidade/logo")
import importlib.util
spec = importlib.util.spec_from_file_location("g", r"c:/Users/Cliente/Documents/Gabriel/BARBOS/MazyOS/identidade/logo/gerar-logo.py")
g = importlib.util.module_from_spec(spec); spec.loader.exec_module(g)

SP = os.path.dirname(os.path.abspath(__file__))
L = r"c:/Users/Cliente/Documents/Gabriel/BARBOS/MazyOS/identidade/logo"

def uri(img):
    buf = io.BytesIO()
    img.save(buf, "PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

def carregar(nome, largura=None):
    im = Image.open(os.path.join(L, nome))
    if largura:
        h = max(1, round(im.height * largura / im.width))
        im = im.resize((largura, h), Image.LANCZOS)
    return im

ativos = {
    "LOGO_CLARO":  uri(carregar("barbos-horizontal-claro.png", 720)),
    "LOGO_ESCURO": uri(carregar("barbos-horizontal-escuro.png", 720)),
    "VERTICAL":    uri(carregar("barbos-vertical-claro.png", 312)),
    "SIMBOLO":     uri(carregar("barbos-simbolo.png", 264)),
    # comparacao honesta: os dois renderizados nativamente a 16px
    "PADRAO16":    uri(g.simbolo(16)),
    "MICRO16":     uri(g.simbolo_micro(16)),
    "MICRO32":     uri(g.simbolo_micro(64)),
}

html = open(os.path.join(SP, "manual.tpl.html"), encoding="utf-8").read()
for k, v in ativos.items():
    html = html.replace("{{%s}}" % k, v)

restantes = [k for k in ativos if "{{%s}}" % k in html]
assert not restantes, restantes
assert "{{" not in html, "placeholder nao substituido"

saida = os.path.join(SP, "manual-barbos.html")
open(saida, "w", encoding="utf-8").write(html)
print(f"{saida}  {len(html)/1024:.0f} KB")
for k, v in ativos.items():
    print(f"  {k:12s} {len(v)/1024:6.1f} KB")

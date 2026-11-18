# -*- coding: utf-8 -*-
"""
Exporta cada slide do carrossel.html em PNG 1080x1350, na pasta instagram/.

    python marketing/conteudo/carrossel-agenda-sinais-2026-11-14/render.py

Usa o Chrome headless direto (sem Playwright): abre o HTML com #s1, #s2…
e o CSS mostra só aquele slide.
"""
import os
import re
import shutil
import subprocess
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(AQUI, "carrossel.html")
SAIDA = os.path.join(AQUI, "instagram")

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def achar_chrome():
    for c in CHROMES:
        if os.path.exists(c):
            return c
    for nome in ("chrome", "msedge", "chromium"):
        achado = shutil.which(nome)
        if achado:
            return achado
    sys.exit("Chrome ou Edge não encontrado.")


def main():
    with open(HTML, encoding="utf-8") as f:
        ids = re.findall(r'class="slide[^"]*" id="(s\d+)"', f.read())
    os.makedirs(SAIDA, exist_ok=True)
    chrome = achar_chrome()
    base = "file:///" + HTML.replace("\\", "/")

    for i, ident in enumerate(ids, start=1):
        destino = os.path.join(SAIDA, f"slide-{i:02d}.png")
        subprocess.run(
            [
                chrome,
                "--headless",
                "--disable-gpu",
                "--hide-scrollbars",
                "--allow-file-access-from-files",
                "--force-device-scale-factor=1",
                "--window-size=1080,1350",
                "--virtual-time-budget=8000",
                f"--screenshot={destino}",
                f"{base}#{ident}",
            ],
            capture_output=True,
            timeout=120,
        )
        print(("ok   " if os.path.exists(destino) else "FALHOU ") + destino)


if __name__ == "__main__":
    main()

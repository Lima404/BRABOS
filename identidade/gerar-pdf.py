# -*- coding: utf-8 -*-
"""
Gera identidade/manual-de-marca.pdf a partir do manual HTML.

Envolve o HTML num documento completo, forca tema claro, aplica folha de
impressao (A4, quebras de pagina, fundo impresso) e roda Chrome headless.

    python identidade/gerar-pdf.py
"""
import os
import shutil
import subprocess
import sys
import tempfile

AQUI = os.path.dirname(os.path.abspath(__file__))
ENTRADA = os.path.join(AQUI, "manual-de-marca.html")
SAIDA = os.path.join(AQUI, "manual-de-marca.pdf")

CHROMES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]

CSS_IMPRESSAO = """
<style>
@page { size: A4; margin: 14mm 13mm 15mm; }

@media print {
  html, body { background: #FFFFFF !important; }
  *, *::before, *::after {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  /* a pagina impressa nao rola: o container vira largura total */
  .wrap { max-width: none; padding: 0; }

  /* faixa da marca sangra no topo da primeira pagina */
  .faixa { margin-bottom: 0; }

  /* cada secao comeca em pagina nova, titulo nunca fica orfao */
  section { break-before: page; padding: 0 0 8mm; border-top: 0; }
  header { padding-top: 0; }
  h2, h3 { break-after: avoid; }
  .eyebrow { break-after: avoid; }
  .lead { break-after: avoid; }

  /* blocos que nao podem ser partidos ao meio */
  .quadro, .especimen, .teste-px, .agenda, .escala,
  .num-demo > div, .regras li, .passos li, .tipo-linha,
  .par-especimen, .badges { break-inside: avoid; }
  table.pares tr { break-inside: avoid; }
  thead { display: table-header-group; }

  /* a tabela nao rola no papel */
  .rolagem { overflow: visible; }
  .pares { font-size: 9.5pt; }

  /* links do rodape em preto, sem sublinhado de tela */
  footer { break-before: avoid; }

  /* densidade um pouco maior no papel */
  body { font-size: 10.5pt; line-height: 1.45; }
  .lead { font-size: 11pt; }
  p, .regras span, .passos span { max-width: none; }
}
</style>
"""

MOLDE = """<!doctype html>
<html lang="pt-BR" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>img{max-width:100%}body{margin:0}</style>
<!--CABECA-->
</head>
<body>
<!--CORPO-->
</body>
</html>
"""


def achar_navegador():
    for c in CHROMES:
        if os.path.exists(c):
            return c
    achado = shutil.which("chrome") or shutil.which("msedge")
    if achado:
        return achado
    sys.exit("Chrome ou Edge nao encontrado. Instale um dos dois.")


def main():
    html = open(ENTRADA, encoding="utf-8").read()

    # o arquivo do artifact nao tem <head>: separa o que precisa ir nele
    corte = html.index("<div class=\"faixa\">")
    cabeca, corpo = html[:corte], html[corte:]

    doc = (MOLDE.replace("<!--CABECA-->", cabeca + CSS_IMPRESSAO)
                .replace("<!--CORPO-->", corpo))

    tmp = os.path.join(tempfile.gettempdir(), "barbos-manual-print.html")
    with open(tmp, "w", encoding="utf-8") as f:
        f.write(doc)

    navegador = achar_navegador()
    print(f"navegador: {navegador}")
    cmd = [
        navegador,
        "--headless",
        "--disable-gpu",
        "--no-pdf-header-footer",
        "--run-all-compositor-stages-before-draw",
        "--virtual-time-budget=10000",
        f"--print-to-pdf={SAIDA}",
        "file:///" + tmp.replace("\\", "/"),
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
    if not os.path.exists(SAIDA):
        print(r.stdout, r.stderr)
        sys.exit("Chrome nao gerou o PDF.")
    print(f"ok: {SAIDA}  {os.path.getsize(SAIDA)/1024:.0f} KB")


if __name__ == "__main__":
    main()

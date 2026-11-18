"""
narracao.py - voz do Antonio (pt-BR-AntonioNeural) frase por frase, montada na grade de 120 BPM.

  python narracao.py gerar      grava takes/<id>.mp3 e takes/<id>.json (tempo de cada palavra, vindo do próprio TTS)
  python narracao.py montar     corta cada take no silêncio, põe cada frase numa batida ou meia batida e grava:
                                  voz.wav        só a voz, -16 LUFS, 48 kHz estéreo
                                  palavras.json  cada palavra com o tempo no vídeo
                                  grade.txt      frase, começo, fim, compasso e batida

Motor: Azure Speech quando AZURE_SPEECH_KEY e AZURE_SPEECH_REGION existem no ambiente (uso comercial coberto).
Sem a chave, Edge TTS: a mesma voz, mas só como rascunho (os termos do serviço do Edge não cobrem uso comercial
com clareza). Para publicar, configure a chave da Azure e rode "gerar" de novo: o resto do vídeo não muda.
"""
import asyncio
import json
import math
import os
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
SR = 48000
BATIDA = 0.5


def _ssl_do_windows():
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass


async def _edge(texto, voz, vel, mp3: Path):
    import edge_tts
    palavras = []
    with open(mp3, "wb") as f:
        async for ch in edge_tts.Communicate(texto, voz, rate=vel, boundary="WordBoundary").stream():
            if ch["type"] == "audio":
                f.write(ch["data"])
            elif ch["type"] == "WordBoundary":
                palavras.append({"p": ch["text"], "i": ch["offset"] / 1e7, "f": (ch["offset"] + ch["duration"]) / 1e7})
    return palavras


def gerar():
    import time
    cfg = json.loads((AQUI / "texto.json").read_text(encoding="utf-8"))
    if os.environ.get("AZURE_SPEECH_KEY") and os.environ.get("AZURE_SPEECH_REGION"):
        sys.exit("A chave da Azure existe: falta ligar o motor azure aqui (mesma voz). Ver narracao.py da skill motion-story-telling-ai.")
    _ssl_do_windows()
    (AQUI / "takes").mkdir(exist_ok=True)
    so = sys.argv[2].split(",") if len(sys.argv) > 2 else None
    for fr in cfg["frases"]:
        if so and fr["id"] not in so:
            continue
        mp3 = AQUI / "takes" / f"{fr['id']}.mp3"
        for tentativa in range(4):
            try:
                pal = asyncio.run(_edge(fr["texto"], cfg["voz"], fr.get("velocidade", cfg["velocidade"]), mp3))
                break
            except Exception as e:  # o serviço recusa pedidos seguidos demais
                print("  tentando de novo:", e)
                time.sleep(3 + 2 * tentativa)
        else:
            sys.exit(f"sem áudio para {fr['id']}")
        (AQUI / "takes" / f"{fr['id']}.json").write_text(json.dumps(pal, ensure_ascii=False), encoding="utf-8")
        print(f"ok {fr['id']}  {pal[-1]['f']:.2f}s  {fr['texto']}")
        time.sleep(1.2)
    (AQUI / "motor_da_voz.txt").write_text(f"edge (rascunho) · {cfg['voz']} · {cfg['velocidade']}\n", encoding="utf-8")


def ler(arq: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(arq), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def energia(x, hop):
    n = len(x) // hop
    return 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)


def recortar(x, pal):
    """Do começo da 1ª palavra (menos 40 ms) até o fim da voz depois da última palavra."""
    ini = max(0, int((pal[0]["i"] - 0.04) * SR))
    fim_min = int(pal[-1]["f"] * SR)
    hop = SR // 100
    e = energia(x, hop)
    k = fim_min // hop
    while k + 1 < len(e) and e[k + 1] > -48:
        k += 1
    fim = min(len(x), (k + 6) * hop)
    s = x[ini:fim].copy()
    r = int(0.006 * SR)
    s[:r] *= np.linspace(0, 1, r)
    s[-r * 3:] *= np.linspace(1, 0, r * 3)
    return s, ini / SR


def montar():
    cfg = json.loads((AQUI / "texto.json").read_text(encoding="utf-8"))
    pedacos, t = [], 0.35          # a primeira palavra entra logo no começo do 1º compasso
    for k, fr in enumerate(cfg["frases"]):
        pal = json.loads((AQUI / "takes" / f"{fr['id']}.json").read_text(encoding="utf-8"))
        s, ini = recortar(ler(AQUI / "takes" / f"{fr['id']}.mp3"), pal)
        if k:
            t = math.ceil((t + fr["pausa"]) / (BATIDA / 2) - 1e-6) * (BATIDA / 2)   # grade de 1/4 de batida (125 ms)
        pedacos.append((fr, s, ini, t, pal))
        t += len(s) / SR
    dur_voz = t
    # duração: compassos inteiros mais meio (N,5 × 2 s), com pelo menos 1,6 s depois da última palavra
    dur = math.ceil((dur_voz + 1.6 - 1.0) / 2.0) * 2.0 + 1.0
    saida = np.zeros(int(dur * SR), np.float32)
    palavras, linhas = [], []
    for fr, s, ini, em, pal in pedacos:
        a = int(em * SR)
        saida[a:a + len(s)] += s
        for w in pal:
            palavras.append({"p": w["p"], "t": round(em + w["i"] - ini, 3), "f": round(em + w["f"] - ini, 3), "id": fr["id"]})
        c, b = int(em // 2) + 1, (em % 2) / BATIDA + 1
        linhas.append(f"{em:6.2f} → {em + len(s) / SR:6.2f}  c{c:02d} b{b:4.2f}  {fr['texto']}")
    tmp = AQUI / "_voz_bruta.wav"
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(saida, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR),
                    "-ac", "2", str(AQUI / "voz.wav")], check=True)
    tmp.unlink()
    (AQUI / "palavras.json").write_text(json.dumps(palavras, ensure_ascii=False, indent=0), encoding="utf-8")
    (AQUI / "grade.txt").write_text(f"duração {dur:.1f} s\n" + "\n".join(linhas) + "\n", encoding="utf-8")
    print("\n".join(linhas))
    print(f"voz até {dur_voz:.2f} s → vídeo de {dur:.1f} s ({len(palavras)} palavras)")


if __name__ == "__main__":
    {"gerar": gerar, "montar": montar}[sys.argv[1] if len(sys.argv) > 1 else "x"]()

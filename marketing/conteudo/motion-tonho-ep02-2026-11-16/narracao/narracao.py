"""
narracao.py - voz do Antonio (pt-BR-AntonioNeural) numa tomada só, com as frases na grade de 120 BPM.

  python narracao.py gerar      lê o texto inteiro de uma vez (takes/inteira.mp3) e guarda o tempo de cada palavra
                                que o próprio TTS devolve (takes/inteira.json)
  python narracao.py montar     mantém a tomada inteira (entonação e respiração naturais) e só mexe nos silêncios:
                                  - silêncio dentro da frase: no máximo 0,38 s
                                  - entre frases: a "pausa" do texto.json, arredondada para a próxima frase começar
                                    na grade de 1/4 de batida (125 ms)
                                grava voz.wav (-16 LUFS, 48 kHz estéreo), palavras.json (cada palavra com o tempo no
                                vídeo e a frase) e grade.txt

Por que tomada única: frases geradas separadas e encaixadas na batida soaram picotadas e "atrasadas" (revisão de
2026-11-15, ver www/claude-skills/ERROS.md). Aqui nenhuma palavra é cortada; só o silêncio muda de tamanho.

Motor: Edge TTS (mesma voz da Azure, sem conta) = rascunho, porque os termos do Edge não cobrem uso comercial com
clareza. Para publicar, gere a mesma tomada pela Azure (ver a skill motion-story-telling-ai) e rode "montar" de novo.
"""
import asyncio
import json
import math
import re
import subprocess
import sys
import time
import unicodedata
import wave
from pathlib import Path

import numpy as np

AQUI = Path(__file__).parent
SR = 48000
GRADE = 0.125            # 1/4 de batida a 120 BPM
TETO_DENTRO = 0.38       # silêncio máximo dentro de uma frase


def _ssl_do_windows():
    try:
        import truststore
        truststore.inject_into_ssl()
    except ImportError:
        pass


def norm(s):
    s = unicodedata.normalize("NFD", s.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in s if unicodedata.category(c) != "Mn"))


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
    cfg = json.loads((AQUI / "texto.json").read_text(encoding="utf-8"))
    _ssl_do_windows()
    (AQUI / "takes").mkdir(exist_ok=True)
    texto = " ".join(fr["texto"] for fr in cfg["frases"])
    mp3 = AQUI / "takes" / "inteira.mp3"
    for tentativa in range(6):
        try:
            pal = asyncio.run(_edge(texto, cfg["voz"], cfg["velocidade"], mp3))
            break
        except Exception as e:  # o serviço recusa pedidos seguidos demais
            print("  tentando de novo:", type(e).__name__, e)
            time.sleep(5 + 5 * tentativa)
    else:
        sys.exit("o Edge TTS não devolveu áudio")
    (AQUI / "takes" / "inteira.json").write_text(json.dumps(pal, ensure_ascii=False, indent=0), encoding="utf-8")
    (AQUI / "motor_da_voz.txt").write_text(f"edge (rascunho) · {cfg['voz']} · {cfg['velocidade']} · tomada única\n", encoding="utf-8")
    print(f"ok inteira.mp3 · {len(pal)} palavras · {pal[-1]['f']:.2f} s")


def ler(arq: Path) -> np.ndarray:
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(arq), "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).copy()


def energia(x, hop):
    n = len(x) // hop
    return 20 * np.log10(np.sqrt((x[:n * hop].reshape(n, hop) ** 2).mean(1)) + 1e-9)


def montar():
    cfg = json.loads((AQUI / "texto.json").read_text(encoding="utf-8"))
    x = ler(AQUI / "takes" / "inteira.mp3")
    ws = json.loads((AQUI / "takes" / "inteira.json").read_text(encoding="utf-8"))
    hop = SR // 100
    e = energia(x, hop)
    ativo = e > -45

    # 1) cada palavra do TTS na sua frase (confere palavra por palavra)
    k = 0
    frases = []
    for fr in cfg["frases"]:
        alvo = [norm(p) for p in fr["texto"].split() if norm(p)]
        meus = []
        for a in alvo:
            if k >= len(ws) or norm(ws[k]["p"]) != a:
                got = ws[k]["p"] if k < len(ws) else "(fim)"
                sys.exit(f"palavra diferente em {fr['id']}: esperava '{a}', o TTS deu '{got}'")
            meus.append(ws[k]); k += 1
        frases.append((fr, meus))

    # 2) trecho de áudio de cada frase: do começo do som da 1ª palavra até o som acabar depois da última
    def comeco(t):
        i = max(0, int((t - 0.12) * 100))
        while i < len(ativo) - 1 and not ativo[i]:
            i += 1
        return max(0, i - 2) * hop

    def fim(t):
        i = min(len(ativo) - 1, int(t * 100))
        while i + 1 < len(ativo) and ativo[i + 1]:
            i += 1
        return min(len(x), (i + 5) * hop)

    pedacos, palavras, linhas = [], [], []
    t = cfg.get("inicio", 0.35)
    fim_ant = 0.0
    for n, (fr, meus) in enumerate(frases):
        a, b = comeco(meus[0]["i"]), fim(meus[-1]["f"])
        s = x[a:b].copy()
        # silêncios internos acima do teto viram o teto (o mapa leva o tempo das palavras junto)
        es = energia(s, hop) > -45
        mapa, out, cur, i = [], [], 0, 0
        while i < len(es):
            if not es[i]:
                j = i
                while j < len(es) and not es[j]:
                    j += 1
                dur = (j - i) * hop / SR
                if dur > TETO_DENTRO and 0 < i and j < len(es):
                    corte = int((dur - TETO_DENTRO) * SR)
                    meio = i * hop + int(TETO_DENTRO * SR / 2)       # tira o miolo do silêncio
                    out.append(s[cur:meio]); mapa.append((meio, corte)); cur = meio + corte
                i = j
            else:
                i += 1
        out.append(s[cur:])
        s = np.concatenate(out)

        def novo(tt_take, a=a, mapa=mapa):
            # tempo no take → tempo dentro do trecho já sem os silêncios cortados
            q, desl = int(tt_take * SR) - a, 0
            for p, c in mapa:
                if q >= p + c:
                    desl += c
                elif q > p:              # caiu dentro do silêncio tirado: vai para o fim dele
                    q = p + c; desl += c
                else:
                    break
            return max(0, q - desl) / SR

        r = int(0.006 * SR)
        s[:r] *= np.linspace(0, 1, r); s[-r * 3:] *= np.linspace(1, 0, r * 3)
        if n:
            t = math.ceil((fim_ant + fr_ant["pausa"]) / GRADE - 1e-6) * GRADE
        pedacos.append((t, s))
        for w in meus:
            palavras.append({"p": w["p"], "t": round(t + novo(w["i"]), 3), "f": round(t + novo(w["f"]), 3), "id": fr["id"]})
        c, bt = int(t // 2) + 1, (t % 2) / 0.5 + 1
        linhas.append(f"{t:6.2f} → {t + len(s) / SR:6.2f}  c{c:02d} b{bt:4.2f}  {fr['texto']}")
        fim_ant = t + len(s) / SR
        fr_ant = fr

    dur_voz = fim_ant
    dur = math.ceil((dur_voz + 1.6 - 1.0) / 2.0) * 2.0 + 1.0     # N,5 compassos, com folga depois da última palavra
    saida = np.zeros(int(dur * SR), np.float32)
    for t0, s in pedacos:
        i = int(round(t0 * SR)); saida[i:i + len(s)] += s[:len(saida) - i]
    tmp = AQUI / "_voz_bruta.wav"
    with wave.open(str(tmp), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(saida, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", str(SR),
                    "-ac", "2", str(AQUI / "voz.wav")], check=True)
    tmp.unlink()
    (AQUI / "palavras.json").write_text(json.dumps(palavras, ensure_ascii=False, indent=0), encoding="utf-8")
    (AQUI / "grade.txt").write_text(f"duração {dur:.1f} s · tomada única\n" + "\n".join(linhas) + "\n", encoding="utf-8")
    print("\n".join(linhas))
    print(f"voz até {dur_voz:.2f} s → vídeo de {dur:.1f} s ({len(palavras)} palavras)")


if __name__ == "__main__":
    {"gerar": gerar, "montar": montar}[sys.argv[1] if len(sys.argv) > 1 else "x"]()

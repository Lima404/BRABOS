"use client";

import { useEffect, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";

import { Botao } from "@/components/ui/botao";
import { FundoPontos } from "@/components/ui/fundo-pontos";
import { CADASTRO } from "@/lib/site";

/**
 * Quantos quadros a cadeira tem.
 *
 * Saíram de um giro de 5 segundos gerado no Higgsfield, cortados de dois em
 * dois pelo ffmpeg: 121 viraram 61. O recorte, a escala e a qualidade estão
 * em `scripts/quadros-da-cadeira.sh` — se os quadros forem refeitos, este
 * número muda junto.
 */
const QUADROS = 61;

const caminhoDoQuadro = (indice: number) =>
  `/cadeira/q${String(indice + 1).padStart(3, "0")}.webp`;

/**
 * O herói: a cadeira gira conforme a página rola.
 *
 * Não é 3D. É uma sequência de imagens trocada num canvas — a mesma técnica
 * que a Apple usa nas páginas de produto. Escolhida de propósito: fica
 * fotorrealista, não traz biblioteca nenhuma de 3D junto, e roda liso em
 * celular fraco, que é onde metade dos barbeiros vai abrir isto.
 */
export function Heroi() {
  const secaoRef = useRef<HTMLElement>(null);
  const telaRef = useRef<HTMLCanvasElement>(null);
  const quadrosRef = useRef<(HTMLImageElement | null)[]>([]);
  const atualRef = useRef(-1);
  const [primeiroPronto, setPrimeiroPronto] = useState(false);

  const { scrollYProgress } = useScroll({
    target: secaoRef,
    offset: ["start start", "end end"],
  });

  // --- carregar os quadros -------------------------------------------------
  useEffect(() => {
    quadrosRef.current = new Array(QUADROS).fill(null);
    let vivo = true;

    const carregar = (indice: number) =>
      new Promise<void>((resolver) => {
        const img = new Image();
        img.decoding = "async";
        img.onload = () => {
          if (!vivo) return;
          quadrosRef.current[indice] = img;
          if (indice === 0) {
            setPrimeiroPronto(true);
            desenhar(0);
          }
          resolver();
        };
        img.onerror = () => resolver();
        img.src = caminhoDoQuadro(indice);
      });

    // O primeiro quadro primeiro, sozinho: é ele que o visitante vê enquanto
    // o resto baixa, e ele não pode esperar na fila dos outros sessenta.
    void carregar(0).then(async () => {
      // Depois os outros, de quatro em quatro, para não abrir sessenta
      // conexões de uma vez e brigar com o resto da página.
      for (let i = 1; i < QUADROS && vivo; i += 4) {
        await Promise.all(
          [i, i + 1, i + 2, i + 3]
            .filter((n) => n < QUADROS)
            .map((n) => carregar(n)),
        );
      }
    });

    return () => {
      vivo = false;
    };
  }, []);

  // --- desenhar ------------------------------------------------------------
  function desenhar(indice: number) {
    const tela = telaRef.current;
    if (!tela) return;

    // Se o quadro exato ainda não baixou, usa o mais próximo que já existe —
    // o giro fica mais duro por um instante, mas nunca pisca em branco.
    let escolhido = quadrosRef.current[indice];
    if (!escolhido) {
      for (let raio = 1; raio < QUADROS; raio++) {
        escolhido =
          quadrosRef.current[indice - raio] ??
          quadrosRef.current[indice + raio] ??
          null;
        if (escolhido) break;
      }
    }
    if (!escolhido) return;

    const pincel = tela.getContext("2d");
    if (!pincel) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const lado = Math.round(tela.clientWidth * dpr);
    if (tela.width !== lado || tela.height !== lado) {
      tela.width = lado;
      tela.height = lado;
    }
    pincel.clearRect(0, 0, lado, lado);
    pincel.drawImage(escolhido, 0, 0, lado, lado);
  }

  useMotionValueEvent(scrollYProgress, "change", (avanco) => {
    const indice = Math.min(
      QUADROS - 1,
      Math.max(0, Math.round(avanco * (QUADROS - 1))),
    );
    if (indice === atualRef.current) return;
    atualRef.current = indice;
    desenhar(indice);
  });

  useEffect(() => {
    const redesenhar = () => desenhar(Math.max(0, atualRef.current));
    window.addEventListener("resize", redesenhar);
    return () => window.removeEventListener("resize", redesenhar);
  }, []);

  return (
    <section
      ref={secaoRef}
      id="topo"
      className="relative h-[180vh] lg:h-[240vh]"
      aria-label="BARBOS"
    >
      <div className="sticky top-0 flex h-screen min-h-[560px] flex-col justify-center overflow-hidden">
        <FundoPontos className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />

        {/* O texto é HTML de servidor e nasce visível. Se o JavaScript
            falhar, a proposta continua na tela — só a cadeira não gira. */}
        <div className="relative z-10 mx-auto w-full max-w-7xl shrink-0 px-4 pt-16 sm:px-6 lg:pt-0">
          <div className="max-w-xl">
            <p className="flex items-center gap-3 text-xs font-semibold tracking-[0.2em] text-ambar-500 uppercase">
              <span className="h-px w-8 bg-ambar-500/60" aria-hidden="true" />
              Gestão para barbearias
            </p>

            <h1 className="mt-6 text-4xl leading-[1.08] font-bold text-balance sm:text-5xl lg:text-6xl">
              O caderno não avisa quando o cliente{" "}
              <span className="text-ambar-500">não vem</span>.
            </h1>

            <p className="mt-6 max-w-md text-lg leading-7 text-graf-300">
              O BARBOS põe agenda, serviços, equipe e estoque numa tela só —
              feita pra ser aberta com o cliente já sentado na cadeira.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Botao href={CADASTRO}>Criar minha conta</Botao>
              <Botao href="#telas" tom="contorno">
                Ver as telas
              </Botao>
            </div>
          </div>
        </div>

        {/*
          A cadeira. No celular ela fica EMBAIXO do texto, com a tela
          inteira para ela; no desktop, ao lado. Antes ela ficava atrás do
          texto, apagada a 35% — e ali não era nem leitura nem imagem.
        */}
        <div className="pointer-events-none relative mt-6 flex min-h-0 flex-1 items-end justify-center pb-14 lg:absolute lg:inset-y-0 lg:right-0 lg:mt-0 lg:w-[58%] lg:items-center lg:justify-end lg:pr-6 lg:pb-0">
          <div className="relative aspect-square h-full max-w-[88vw] lg:h-auto lg:w-[min(52vw,88vh)]">
            <canvas
              ref={telaRef}
              className="h-full w-full transition-opacity duration-700"
              style={{
                opacity: primeiroPronto ? undefined : 0,
                /*
                 * O halo âmbar está gravado nos quadros, e o canto dos
                 * quadros não é exatamente a cor do fundo da página — sem
                 * esta máscara aparece a costura retangular do canvas
                 * contra a página. Com ela, a luz morre antes da borda e
                 * a cadeira flutua no escuro.
                 */
                maskImage:
                  "radial-gradient(ellipse 72% 72% at 50% 48%, #000 58%, transparent 100%)",
              }}
              aria-hidden="true"
            />
          </div>
        </div>

        {/* Dica de rolagem. Some assim que a pessoa começa a rolar. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-7 flex justify-center"
          aria-hidden="true"
        >
          <span className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.18em] text-graf-500 uppercase">
            <span className="block h-6 w-px animate-pulse bg-linear-to-b from-transparent to-graf-500 motion-reduce:animate-none" />
            Role para girar
          </span>
        </div>
      </div>
    </section>
  );
}

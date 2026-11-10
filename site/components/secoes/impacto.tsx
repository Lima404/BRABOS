"use client";

import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useRef, type CSSProperties } from "react";

import { Contador } from "@/components/ui/contador";
import { useLuz } from "@/components/ui/luz";
import { MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";
import { useVisto } from "@/components/ui/visto";
import { CONTORNO_RN, RN } from "@/lib/rn";

/**
 * Os números do impacto. Quando um deles mudar, é só mudar aqui: a seção
 * inteira, inclusive o que o leitor de tela lê, sai desta lista.
 */
const NUMEROS = [
  { valor: 27, mais: false, rotulo: "barbearias no Rio Grande do Norte" },
  { valor: 10000, mais: true, rotulo: "agendamentos" },
  { valor: 800, mais: true, rotulo: "clientes satisfeitos" },
] as const;

/**
 * Capítulo 07 — o impacto, no mapa do Rio Grande do Norte.
 *
 * - ROLAGEM: o contorno do estado se desenha conforme o mapa entra na tela,
 *   e os números contam do zero quando aparecem.
 * - AUTOMÁTICO: de tempos em tempos uma faixa de luz atravessa o estado de
 *   oeste a leste, acendendo as divisas dos municípios por onde passa.
 * - MOUSE: um holofote âmbar acende os municípios embaixo do cursor, e o
 *   mapa inclina na direção dele. Sem mouse, o holofote passeia sozinho.
 *
 * Não há ponto marcando cada barbearia de propósito: um ponto no mapa diz
 * "é nesta cidade", e a lista de cidades ainda não está no site.
 */
export function Impacto() {
  const listaRef = useRef<HTMLUListElement>(null);
  useVisto(listaRef);

  return (
    <section id="impacto" className="relative overflow-hidden py-28 sm:py-36">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:grid-rows-[auto_1fr] lg:gap-x-16 lg:gap-y-10">
        <div className="lg:col-start-2">
          <Rotulo capitulo="impacto">Nosso impacto</Rotulo>
          <Revela
            texto="O Rio Grande do Norte já está saindo do caderno."
            destaque="saindo do caderno."
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-md text-base leading-7 text-graf-300">
            27 barbearias da região já fecharam com o BARBOS. O simples bem
            feito, pro barbeiro e pro cliente dele.
          </p>
        </div>

        <Mapa />

        <ul
          ref={listaRef}
          className="lista-aparece grid sm:grid-cols-3 lg:col-start-2 lg:grid-cols-1"
        >
          {NUMEROS.map((numero, i) => (
            <li
              key={numero.rotulo}
              className="border-t border-graf-800 py-6 sm:pr-6 lg:pr-0"
              style={{ "--ordem": i } as CSSProperties}
            >
              <p className="numeros flex items-baseline text-5xl font-bold tracking-[-0.03em] text-white sm:text-6xl">
                {numero.mais && (
                  <>
                    <span className="sr-only">Mais de </span>
                    <span aria-hidden="true" className="mr-1 text-ambar-500">
                      +
                    </span>
                  </>
                )}
                <Contador ate={numero.valor} formato="milhar" duracao={1800} />
              </p>
              <p className="mt-2 text-sm text-graf-300 sm:text-base">
                {numero.rotulo}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

const MOLA = { stiffness: 90, damping: 18 };

function Mapa() {
  const palcoRef = useRef<HTMLDivElement>(null);
  const reduzido = useMidia(MENOS_MOVIMENTO);

  // --- o contorno, desenhado pela rolagem ------------------------------------
  const chegada = useProgresso(palcoRef, ["start 90%", "center 55%"]);
  const tracoMola = useSpring(chegada, { stiffness: 60, damping: 20 });
  // Movimento reduzido: o estado já nasce desenhado.
  const tracoPronto = useMotionValue(1);
  const traco = reduzido ? tracoPronto : tracoMola;
  const preenchimento = useTransform(traco, [0.75, 1], [0, 0.07]);

  // --- o holofote e a inclinação ----------------------------------------------
  const luz = useLuz(palcoRef, {
    ligado: !reduzido,
    descanso: { x: 0.25, y: -0.1 },
    orbita: { x: 0.6, y: 0.45 },
  });
  const holofoteX = useTransform(luz.x, [-1, 1], ["0%", "100%"]);
  const holofoteY = useTransform(luz.y, [-1, 1], ["0%", "100%"]);
  const luzX = useTransform(luz.x, [-1, 1], [0, RN.largura]);
  const luzY = useTransform(luz.y, [-1, 1], [0, RN.altura]);
  const giroY = useSpring(useTransform(luz.x, [-1, 1], [-7, 7]), MOLA);
  const giroX = useSpring(useTransform(luz.y, [-1, 1], [6, -6]), MOLA);

  return (
    <div
      ref={palcoRef}
      aria-hidden="true"
      className="relative lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:self-center"
      style={{ perspective: 1400 }}
    >
      <div className="luz-ambar pointer-events-none absolute inset-[-12%] opacity-70" />

      <motion.div
        className="relative w-full"
        style={{
          aspectRatio: `${RN.largura} / ${RN.altura}`,
          ...(reduzido ? { rotateX: 0, rotateY: 0 } : { rotateX: giroX, rotateY: giroY }),
        }}
      >
        <div className="rn-camada rn-municipios" />
        <div className="rn-camada rn-varredura" />
        <motion.div
          className="rn-camada rn-holofote"
          style={{ "--hx": holofoteX, "--hy": holofoteY } as never}
        />

        <svg
          viewBox={`0 0 ${RN.largura} ${RN.altura}`}
          className="absolute inset-0 h-full w-full overflow-visible"
        >
          <defs>
            {/* A luz do holofote fica recortada no formato do estado. */}
            <clipPath id="rn-recorte">
              <path d={CONTORNO_RN} />
            </clipPath>
            <radialGradient id="rn-luz">
              <stop offset="0%" style={{ stopColor: "var(--color-ambar-500)", stopOpacity: 0.32 }} />
              <stop offset="100%" style={{ stopColor: "var(--color-ambar-500)", stopOpacity: 0 }} />
            </radialGradient>
            <filter id="rn-brilho" x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="largo" />
              <feMerge>
                <feMergeNode in="largo" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <motion.path
            d={CONTORNO_RN}
            className="fill-ambar-500"
            style={{ opacity: preenchimento }}
          />
          <g clipPath="url(#rn-recorte)">
            <motion.circle cx={luzX} cy={luzY} r={190} fill="url(#rn-luz)" />
          </g>
          <motion.path
            d={CONTORNO_RN}
            fill="none"
            className="stroke-ambar-300"
            strokeWidth={2.6}
            strokeLinejoin="round"
            strokeLinecap="round"
            filter="url(#rn-brilho)"
            style={{ pathLength: traco }}
          />
        </svg>
      </motion.div>
    </div>
  );
}

"use client";

import { motion, useSpring, useTransform, type MotionValue } from "motion/react";
import { useRef } from "react";

import { Contador } from "@/components/ui/contador";
import { MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";
import { useProgresso } from "@/components/ui/progresso";
import { Revela } from "@/components/ui/revela";
import { Rotulo } from "@/components/ui/rotulo";

const PASSOS = [
  {
    titulo: "Cria a conta",
    texto:
      "Nome da barbearia, e-mail e senha. Leva menos de um minuto e não pede cartão.",
  },
  {
    titulo: "Põe os serviços e a equipe",
    texto:
      "Corte, barba e sobrancelha, com preço, duração e cor. Depois os barbeiros, cada um com o próprio horário.",
  },
  {
    titulo: "Manda o link pro cliente",
    texto:
      "A barbearia ganha uma página de agendamento. O cliente marca sem criar conta nem senha, e o horário cai direto na sua agenda.",
  },
];

/**
 * Capítulo 06 — a prova e os passos.
 *
 * - AUTOMÁTICO: os três números contam do zero quando entram na tela.
 * - ROLAGEM: uma linha âmbar corre de um passo ao outro conforme a página
 *   desce, e cada passo acende quando ela chega nele.
 * - MOUSE: cada cartão tem uma luz que segue o cursor por dentro dele.
 */
export function Passos() {
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const listaRef = useRef<HTMLOListElement>(null);
  const progresso = useProgresso(listaRef, ["start 85%", "end 55%"]);
  const linha = useSpring(progresso, { stiffness: 120, damping: 26 });
  const avanco = reduzido ? progresso : linha;

  return (
    <section id="passos" className="relative py-28 sm:py-36">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* A prova: um mês de verdade, contado do zero. */}
        <div className="grid gap-10 border-y border-graf-800 py-14 sm:grid-cols-3">
          <Numero rotulo="atendimentos em outubro" valor={234} />
          <Numero rotulo="somados sem calculadora" valor={9966} formato="reais" />
          <Numero rotulo="dias de atendimento no mês" valor={27} />
        </div>

        <div className="mt-24 max-w-2xl">
          <Rotulo capitulo="passos">Como começa</Rotulo>
          <Revela
            texto="Três passos, e o caderno vira enfeite."
            destaque="vira enfeite."
            className="mt-5 text-[clamp(1.75rem,3.6vw,3rem)] leading-[1.05] font-bold tracking-[-0.025em] text-balance"
          />
          <p className="mt-5 max-w-xl text-base leading-7 text-graf-300">
            Se o cliente da barbearia usa, a barbearia usa também. Não existe
            sistema de barbearia que o barbeiro usa e o cliente dele não. Por
            isso o último passo é dele.
          </p>
        </div>

        <ol ref={listaRef} className="relative mt-16 grid gap-6 md:grid-cols-3">
          {/* O trilho e a linha que corre nele. No celular ele é vertical,
              do lado esquerdo; no computador, horizontal, por cima. */}
          <span
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-[1.15rem] w-px bg-graf-800 md:top-[1.15rem] md:right-[16%] md:bottom-auto md:left-[1.15rem] md:h-px md:w-auto"
          />
          <motion.span
            aria-hidden="true"
            className="absolute top-0 bottom-0 left-[1.15rem] w-px origin-top bg-ambar-500 md:hidden"
            style={{ scaleY: avanco }}
          />
          <motion.span
            aria-hidden="true"
            className="absolute top-[1.15rem] right-[16%] left-[1.15rem] hidden h-px origin-left bg-ambar-500 md:block"
            style={{ scaleX: avanco }}
          />

          {PASSOS.map((passo, i) => (
            <Passo
              key={passo.titulo}
              indice={i}
              titulo={passo.titulo}
              texto={passo.texto}
              avanco={avanco}
            />
          ))}
        </ol>
      </div>
    </section>
  );
}

function Passo({
  indice,
  titulo,
  texto,
  avanco,
}: {
  indice: number;
  titulo: string;
  texto: string;
  avanco: MotionValue<number>;
}) {
  // A linha chega em cada passo num terço do caminho.
  const chegada = indice / PASSOS.length;
  const aceso = useTransform(avanco, [chegada, chegada + 0.08], [0, 1]);
  const apagado = useTransform(aceso, (v) => 1 - v);
  const cartaoRef = useRef<HTMLDivElement>(null);

  function moveu(evento: React.PointerEvent) {
    const cartao = cartaoRef.current;
    if (!cartao || evento.pointerType !== "mouse") return;
    const caixa = cartao.getBoundingClientRect();
    cartao.style.setProperty("--mx", `${evento.clientX - caixa.left}px`);
    cartao.style.setProperty("--my", `${evento.clientY - caixa.top}px`);
  }

  return (
    <li className="relative pl-14 md:pt-14 md:pl-0">
      {/* A bolinha do passo: acende quando a linha chega. */}
      <span className="absolute top-0 left-0 grid h-[2.3rem] w-[2.3rem] place-items-center rounded-full border border-graf-700 bg-graf-950">
        <motion.span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-ambar-500"
          style={{ opacity: aceso, scale: aceso }}
        />
        {/* Branco no escuro, grafite no âmbar — nunca branco sobre âmbar. */}
        <motion.span
          className="numeros absolute text-xs font-bold text-white"
          style={{ opacity: apagado }}
        >
          {String(indice + 1).padStart(2, "0")}
        </motion.span>
        <motion.span
          aria-hidden="true"
          className="numeros absolute text-xs font-bold text-graf-900"
          style={{ opacity: aceso }}
        >
          {String(indice + 1).padStart(2, "0")}
        </motion.span>
      </span>

      <div
        ref={cartaoRef}
        onPointerMove={moveu}
        className="cartao-luz relative h-full overflow-hidden rounded-xl border border-graf-800 bg-graf-900/60 p-7 transition-colors duration-300 hover:border-graf-700"
      >
        <span aria-hidden="true" className="cartao-luz-brilho" />
        <h3 className="relative text-lg font-bold text-white">{titulo}</h3>
        <p className="relative mt-2 text-sm leading-6 text-graf-300">{texto}</p>
      </div>
    </li>
  );
}

function Numero({
  rotulo,
  valor,
  formato,
}: {
  rotulo: string;
  valor: number;
  formato?: "numero" | "reais";
}) {
  return (
    <div>
      <p className="numeros text-4xl font-bold tracking-[-0.02em] text-white sm:text-5xl">
        <Contador ate={valor} formato={formato} />
      </p>
      <p className="mt-2 text-sm text-graf-300">{rotulo}</p>
    </div>
  );
}

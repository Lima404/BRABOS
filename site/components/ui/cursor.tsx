"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useEffect, useState } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";

/**
 * O anel que segue o mouse.
 *
 * Não substitui a seta do sistema — ela continua lá, porque esconder o
 * cursor de verdade é o tipo de capricho que atrapalha quem tem baixa
 * visão. O anel vem atrás, com uma mola, e muda de forma conforme o que
 * está embaixo dele:
 *
 * - em link ou botão, cresce e acende;
 * - em qualquer elemento com `data-cursor="Texto"`, vira uma pílula com
 *   esse texto — é como uma seção diz "arraste", "gire" ou "corte" sem
 *   escrever instrução na tela.
 *
 * Só existe com mouse de verdade e sem pedido de movimento reduzido. No
 * celular não há o que seguir.
 */
export function Cursor() {
  const temMouse = useMidia(COM_MOUSE);
  const reduzido = useMidia(MENOS_MOVIMENTO);
  if (!temMouse || reduzido) return null;
  return <Anel />;
}

function Anel() {
  const [rotulo, setRotulo] = useState<string | null>(null);
  const [sobreAcao, setSobreAcao] = useState(false);
  const [apertado, setApertado] = useState(false);
  const [dentro, setDentro] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const mola = { stiffness: 420, damping: 36, mass: 0.55 };
  const xAnel = useSpring(x, mola);
  const yAnel = useSpring(y, mola);

  useEffect(() => {
    function moveu(evento: PointerEvent) {
      if (evento.pointerType !== "mouse") return;
      x.set(evento.clientX);
      y.set(evento.clientY);
      setDentro(true);
    }

    function passouPor(evento: PointerEvent) {
      const alvo = evento.target as Element | null;
      const comRotulo = alvo?.closest<HTMLElement>("[data-cursor]");
      setRotulo(comRotulo?.dataset.cursor ?? null);
      setSobreAcao(
        Boolean(alvo?.closest("a, button, [role='switch'], label, summary")),
      );
    }

    function saiu(evento: MouseEvent) {
      if (!evento.relatedTarget) setDentro(false);
    }

    const apertou = () => setApertado(true);
    const soltou = () => setApertado(false);

    window.addEventListener("pointermove", moveu, { passive: true });
    window.addEventListener("pointerover", passouPor, { passive: true });
    window.addEventListener("pointerdown", apertou);
    window.addEventListener("pointerup", soltou);
    document.addEventListener("mouseout", saiu);
    return () => {
      window.removeEventListener("pointermove", moveu);
      window.removeEventListener("pointerover", passouPor);
      window.removeEventListener("pointerdown", apertou);
      window.removeEventListener("pointerup", soltou);
      document.removeEventListener("mouseout", saiu);
    };
  }, [x, y]);

  const tamanho = rotulo ? 92 : sobreAcao ? 56 : 34;

  return (
    <>
      {/* O anel, com a mola. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[70]"
        style={{ x: xAnel, y: yAnel }}
      >
        <motion.div
          className={`flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border text-center text-[11px] leading-tight font-semibold tracking-[0.12em] text-white uppercase transition-[background-color,border-color] duration-300 ${
            rotulo
              ? "border-ambar-500/70 bg-graf-950/80 backdrop-blur-sm"
              : sobreAcao
                ? "border-ambar-500/80 bg-ambar-500/10"
                : "border-graf-300/50"
          }`}
          animate={{
            width: tamanho,
            height: tamanho,
            opacity: dentro ? 1 : 0,
            scale: apertado ? 0.86 : 1,
          }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
        >
          {rotulo && <span className="px-2">{rotulo}</span>}
        </motion.div>
      </motion.div>

      {/* O ponto, preso na ponta da seta, sem mola. */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-0 z-[70]"
        style={{ x, y }}
      >
        <motion.div
          className="h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ambar-500"
          animate={{ opacity: dentro && !rotulo ? 1 : 0 }}
        />
      </motion.div>
    </>
  );
}

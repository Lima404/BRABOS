"use client";

import { motion, useMotionValue, useSpring } from "motion/react";
import { useRef, type ReactNode } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";

/**
 * Um botão que é puxado pelo cursor quando ele chega perto.
 *
 * O deslocamento é uma fração da distância até o centro, com teto: o botão
 * se inclina na direção do mouse, mas nunca foge dele — o clique continua
 * caindo onde a pessoa mirou. Ao sair, a mola devolve ao lugar.
 */
export function Magnetico({
  children,
  forca = 0.32,
  className = "",
}: {
  children: ReactNode;
  forca?: number;
  className?: string;
}) {
  const temMouse = useMidia(COM_MOUSE);
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const ligado = temMouse && !reduzido;

  const caixaRef = useRef<HTMLSpanElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const mola = { stiffness: 260, damping: 18, mass: 0.5 };
  const xMola = useSpring(x, mola);
  const yMola = useSpring(y, mola);

  function moveu(evento: React.PointerEvent) {
    if (!ligado || evento.pointerType !== "mouse") return;
    const caixa = caixaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    const dx = evento.clientX - (caixa.left + caixa.width / 2);
    const dy = evento.clientY - (caixa.top + caixa.height / 2);
    x.set(Math.max(-14, Math.min(14, dx * forca)));
    y.set(Math.max(-10, Math.min(10, dy * forca)));
  }

  function saiu() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.span
      ref={caixaRef}
      className={`inline-flex ${className}`}
      style={{ x: xMola, y: yMola }}
      onPointerMove={moveu}
      onPointerLeave={saiu}
    >
      {children}
    </motion.span>
  );
}

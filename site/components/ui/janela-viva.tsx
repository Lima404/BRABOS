"use client";

import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { useRef, type ReactNode } from "react";

import { COM_MOUSE, MENOS_MOVIMENTO, useMidia } from "@/components/ui/midia";

/**
 * A moldura de uma tela do sistema que responde ao mouse.
 *
 * Duas coisas, as duas discretas — a tela tem que continuar legível:
 * um holofote âmbar que segue o cursor por cima da interface (o "spotlight
 * glow tracker" do MazyOS/jquery.html), e uma inclinação de no máximo dois
 * graus na direção dele. Ao sair, tudo volta ao lugar com mola.
 */
export function JanelaViva({ children }: { children: ReactNode }) {
  const temMouse = useMidia(COM_MOUSE);
  const reduzido = useMidia(MENOS_MOVIMENTO);
  const ligado = temMouse && !reduzido;

  const caixaRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0.5);
  const y = useMotionValue(0.5);
  const presenca = useMotionValue(0);

  const mola = { stiffness: 140, damping: 22 };
  const giroY = useSpring(useTransform(x, [0, 1], [-2, 2]), mola);
  const giroX = useSpring(useTransform(y, [0, 1], [1.5, -1.5]), mola);
  const brilho = useSpring(presenca, { stiffness: 200, damping: 30 });

  const px = useTransform(x, (v) => `${v * 100}%`);
  const py = useTransform(y, (v) => `${v * 100}%`);
  const holofote = useMotionTemplate`radial-gradient(28rem circle at ${px} ${py}, color-mix(in srgb, var(--color-ambar-500) 13%, transparent), transparent 65%)`;

  function moveu(evento: React.PointerEvent) {
    if (!ligado || evento.pointerType !== "mouse") return;
    const caixa = caixaRef.current?.getBoundingClientRect();
    if (!caixa) return;
    x.set((evento.clientX - caixa.left) / caixa.width);
    y.set((evento.clientY - caixa.top) / caixa.height);
    presenca.set(1);
  }

  function saiu() {
    x.set(0.5);
    y.set(0.5);
    presenca.set(0);
  }

  return (
    <div style={{ perspective: 1800 }}>
      <motion.div
        ref={caixaRef}
        className="relative"
        onPointerMove={moveu}
        onPointerLeave={saiu}
        style={
          ligado
            ? { rotateX: giroX, rotateY: giroY }
            : { rotateX: 0, rotateY: 0 }
        }
      >
        {children}
        {ligado && (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl mix-blend-screen"
            style={{ background: holofote, opacity: brilho }}
          />
        )}
      </motion.div>
    </div>
  );
}

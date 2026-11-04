"use client";

import { useMotionValue, type MotionValue } from "motion/react";
import { useEffect, type RefObject } from "react";

/**
 * Onde está a luz de uma cena, de -1 a 1 nos dois eixos.
 *
 * Com mouse, a luz vai atrás do cursor. Quando o mouse para por alguns
 * segundos — ou quando não existe mouse, no celular —, ela passa a passear
 * sozinha numa órbita lenta. Assim a mesma cena é interativa no computador
 * e viva no celular, sem dois códigos.
 *
 * O laço dorme quando a cena sai da tela, e nem liga para quem pediu
 * movimento reduzido: a luz fica parada no ponto de descanso.
 */
export function useLuz(
  palcoRef: RefObject<HTMLElement | null>,
  {
    ligado,
    descanso = { x: 0.3, y: 0 },
    orbita = { x: 0.32, y: 0.28 },
  }: {
    ligado: boolean;
    descanso?: { x: number; y: number };
    orbita?: { x: number; y: number };
  },
): { x: MotionValue<number>; y: MotionValue<number> } {
  const x = useMotionValue(descanso.x);
  const y = useMotionValue(descanso.y);

  useEffect(() => {
    const palco = palcoRef.current;
    if (!palco || !ligado) return;

    let visivel = false;
    let pedido = 0;
    let ultimoMouse = -Infinity;
    let alvoX = descanso.x;
    let alvoY = descanso.y;
    let atualX = descanso.x;
    let atualY = descanso.y;

    function quadro(agora: number) {
      pedido = 0;
      if (!visivel) return;

      // Quatro segundos sem mouse e a luz volta a passear.
      if (agora - ultimoMouse > 4000) {
        alvoX = descanso.x + orbita.x * Math.cos(agora / 2900);
        alvoY = descanso.y + orbita.y * Math.sin(agora / 2100);
      }

      atualX += (alvoX - atualX) * 0.06;
      atualY += (alvoY - atualY) * 0.06;
      x.set(atualX);
      y.set(atualY);
      pedido = requestAnimationFrame(quadro);
    }

    function moveu(evento: PointerEvent) {
      if (evento.pointerType !== "mouse") return;
      const caixa = palco!.getBoundingClientRect();
      alvoX = ((evento.clientX - caixa.left) / caixa.width) * 2 - 1;
      alvoY = ((evento.clientY - caixa.top) / caixa.height) * 2 - 1;
      ultimoMouse = performance.now();
    }

    const observador = new IntersectionObserver(([entrada]) => {
      visivel = entrada.isIntersecting;
      if (visivel && !pedido) pedido = requestAnimationFrame(quadro);
    });
    observador.observe(palco);
    window.addEventListener("pointermove", moveu, { passive: true });

    return () => {
      observador.disconnect();
      cancelAnimationFrame(pedido);
      window.removeEventListener("pointermove", moveu);
    };
  }, [palcoRef, ligado, descanso.x, descanso.y, orbita.x, orbita.y, x, y]);

  return { x, y };
}

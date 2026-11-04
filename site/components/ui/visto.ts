"use client";

import { useEffect, type RefObject } from "react";

/**
 * Marca o elemento com `data-visto` na primeira vez que ele entra na tela.
 *
 * Quem anima é o CSS, olhando esse atributo. Separar assim deixa o HTML do
 * servidor completo e visível: sem JavaScript, nada fica escondido
 * esperando um atributo que nunca chega (ver `.js` em globals.css).
 */
export function useVisto(
  ref: RefObject<HTMLElement | null>,
  limiar = 0.3,
): void {
  useEffect(() => {
    const no = ref.current;
    if (!no) return;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        no.dataset.visto = "";
        observador.disconnect();
      },
      { threshold: limiar },
    );
    observador.observe(no);
    return () => observador.disconnect();
  }, [ref, limiar]);
}

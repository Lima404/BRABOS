"use client";

import { useSyncExternalStore } from "react";

/**
 * Uma media query lida do navegador, e acompanhada.
 *
 * No servidor a resposta é sempre `false`: o HTML sai na versão mais
 * simples — sem cursor próprio, sem parallax de mouse — e o navegador
 * liga o resto depois de hidratar, se a tela pedir.
 */
export function useMidia(consulta: string): boolean {
  return useSyncExternalStore(
    (avisar) => {
      const lista = window.matchMedia(consulta);
      lista.addEventListener("change", avisar);
      return () => lista.removeEventListener("change", avisar);
    },
    () => window.matchMedia(consulta).matches,
    () => false,
  );
}

/** Tem mouse de verdade: aponta com precisão e passa por cima das coisas. */
export const COM_MOUSE = "(hover: hover) and (pointer: fine)";

/** A pessoa pediu menos movimento no sistema operacional. */
export const MENOS_MOVIMENTO = "(prefers-reduced-motion: reduce)";

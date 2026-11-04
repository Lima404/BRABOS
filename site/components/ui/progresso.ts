"use client";

import { useScroll, useTransform, type MotionValue } from "motion/react";
import type { RefObject } from "react";

type Offset = NonNullable<Parameters<typeof useScroll>[0]>["offset"];

/**
 * O quanto uma seção já andou na rolagem, de 0 a 1 — com a régua certa.
 *
 * Por que não usar o `scrollYProgress` do `useScroll` direto: desde a 12.x
 * o motion tenta entregar opacidade e transform a uma `ViewTimeline` nativa
 * do navegador, para rodar fora da thread principal. Só que a ViewTimeline
 * mede o caminho da seção INTEIRA cruzando a tela e ignora o `offset` que a
 * gente passa. Numa seção presa de 300vh isso dá outra régua: em 55% da
 * coreografia o navegador achava que estava em 30%, e o texto ficava
 * pela metade, apagado. (Medido com `getAnimations()` em 04/11/2026.)
 *
 * Passar o valor por uma função tira essa aceleração — o motion não
 * consegue traduzir uma função em keyframes — e todo mundo volta a ler o
 * mesmo número, calculado em JavaScript.
 */
export function useProgresso(
  alvo: RefObject<HTMLElement | null>,
  offset: Offset = ["start start", "end end"],
): MotionValue<number> {
  const { scrollYProgress } = useScroll({ target: alvo, offset });
  return useTransform(scrollYProgress, (valor) => valor);
}

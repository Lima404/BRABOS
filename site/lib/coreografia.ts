import type { CSSProperties } from "react";

/**
 * O degrau de um pedaço dentro de uma cena: em que ponto da rolagem ele
 * começa a entrar, e quanto do caminho ele leva para entrar inteiro.
 *
 * Vive num módulo próprio, fora do `components/ui/cena.tsx`, porque aquele
 * arquivo é `"use client"` e isto aqui é chamado por componente de
 * servidor — a Agenda e o Dashboard são montados no servidor, e o Next
 * recusa chamar uma função de cliente de lá.
 */
export function degrau(inicio: number, janela = 0.12): CSSProperties {
  return { "--degrau": inicio, "--janela": janela } as CSSProperties;
}

"use client";

import { useSyncExternalStore } from "react";

import { CAPITULOS } from "@/lib/capitulos";

/**
 * Qual capítulo está na tela agora.
 *
 * O menu do topo e o trilho lateral precisam da mesma resposta. Em vez de
 * cada um medir a página por conta própria, os dois assinam esta única
 * medição: um ouvinte de rolagem para o site inteiro, que só avisa quando o
 * capítulo de fato muda — rolar dentro do mesmo capítulo não re-renderiza
 * ninguém.
 *
 * O critério é uma linha a 45% da altura da tela: o capítulo ativo é o
 * último cujo topo já passou por ela. Assim uma seção presa, de 300vh,
 * continua ativa durante toda a sua coreografia.
 */
const PRIMEIRO = CAPITULOS[0].id;

let ativo = PRIMEIRO;
let pedido = 0;
const ouvintes = new Set<() => void>();

function medir() {
  pedido = 0;
  const linha = window.innerHeight * 0.45;
  let atual = PRIMEIRO;
  for (const capitulo of CAPITULOS) {
    const no = document.getElementById(capitulo.id);
    if (no && no.getBoundingClientRect().top <= linha) atual = capitulo.id;
  }
  if (atual === ativo) return;
  ativo = atual;
  ouvintes.forEach((avisar) => avisar());
}

function agendar() {
  if (!pedido) pedido = requestAnimationFrame(medir);
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  if (ouvintes.size === 1) {
    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    medir();
  }
  return () => {
    ouvintes.delete(avisar);
    if (ouvintes.size > 0) return;
    window.removeEventListener("scroll", agendar);
    window.removeEventListener("resize", agendar);
    cancelAnimationFrame(pedido);
    pedido = 0;
  };
}

export function useCapituloAtivo(): string {
  return useSyncExternalStore(
    assinar,
    () => ativo,
    () => PRIMEIRO,
  );
}

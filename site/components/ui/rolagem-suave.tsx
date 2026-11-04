"use client";

import Lenis from "lenis";
import { useEffect } from "react";

/**
 * A rolagem com inércia.
 *
 * O site é contado em capítulos que se montam com a rolagem, e a roda do
 * mouse anda aos trancos de 100px — cada tranco vira um salto na animação.
 * O Lenis amacia esses saltos e a coreografia passa a deslizar.
 *
 * Três cuidados:
 * - Ele continua rolando a JANELA, não um contêiner falso. A barra de
 *   rolagem, o Ctrl+F, o leitor de tela e o `position: sticky` funcionam
 *   igual — por isso o `useScroll` do motion e a `Cena` não precisam saber
 *   que ele existe.
 * - No toque ele não mexe em nada: o dedo já rola com inércia nativa.
 * - Quem pediu menos movimento no sistema fica com a rolagem do navegador.
 */
export function RolagemSuave() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: true,
      lerp: 0.11,
      // Os links "#ferramentas" do menu e do trilho passam a deslizar até
      // a seção, em vez de pular.
      anchors: true,
      // O mockup das telas rola de lado dentro da própria moldura no
      // celular. Sem isto, o Lenis roubava esse gesto para a página.
      allowNestedScroll: true,
    });

    return () => lenis.destroy();
  }, []);

  return null;
}

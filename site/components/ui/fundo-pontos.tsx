"use client";

import { useEffect, useRef } from "react";

/**
 * A malha de pontos que foge do cursor.
 *
 * Adaptado do "Dot Matrix Warp" do MazyOS/backgrounds.html. Mudou três
 * coisas: a cor saiu do índigo para o âmbar da marca, os pontos têm uma
 * mola em vez de saltarem direto para a posição deslocada (o original
 * tremia quando o mouse parava em cima de um ponto), e o laço dorme
 * quando a tela não está à vista.
 */
export function FundoPontos({ className }: { className?: string }) {
  const telaRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tela = telaRef.current;
    if (!tela) return;
    const pincel = tela.getContext("2d", { alpha: true });
    if (!pincel) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Desenha a malha uma vez, parada, e vai embora.
      desenharParado();
      return;
    }

    const PASSO = 34;
    const ALCANCE = 150;
    const EMPURRAO = 20;

    let largura = 0;
    let altura = 0;
    let pedido = 0;
    let visivel = true;

    // Onde o mouse está, e para onde ele está indo. A diferença entre os
    // dois é a mola — sem ela o ponto embaixo do cursor vibra.
    const rato = { x: -9999, y: -9999, alvoX: -9999, alvoY: -9999 };

    function medir() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const caixa = tela!.getBoundingClientRect();
      largura = caixa.width;
      altura = caixa.height;
      tela!.width = Math.round(largura * dpr);
      tela!.height = Math.round(altura * dpr);
      pincel!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function desenharParado() {
      medir();
      pincel!.clearRect(0, 0, largura, altura);
      pincel!.fillStyle = "rgba(168, 176, 188, 0.14)";
      for (let x = 34; x < largura; x += 34) {
        for (let y = 34; y < altura; y += 34) {
          pincel!.beginPath();
          pincel!.arc(x, y, 1.1, 0, Math.PI * 2);
          pincel!.fill();
        }
      }
    }

    function quadro() {
      pedido = requestAnimationFrame(quadro);
      if (!visivel) return;

      rato.x += (rato.alvoX - rato.x) * 0.14;
      rato.y += (rato.alvoY - rato.y) * 0.14;

      pincel!.clearRect(0, 0, largura, altura);

      for (let x = PASSO; x < largura; x += PASSO) {
        for (let y = PASSO; y < altura; y += PASSO) {
          const dx = x - rato.x;
          const dy = y - rato.y;
          const distancia = Math.hypot(dx, dy);

          let px = x;
          let py = y;
          let raio = 1.1;
          let cor = "rgba(168, 176, 188, 0.14)";

          if (distancia < ALCANCE && distancia > 0.001) {
            const perto = 1 - distancia / ALCANCE;
            const forca = perto * EMPURRAO;
            px += (dx / distancia) * forca;
            py += (dy / distancia) * forca;
            raio = 1.1 + perto * 1.5;
            // Âmbar-500 acendendo conforme o ponto chega perto do cursor.
            cor = `rgba(240, 169, 59, ${(0.18 + perto * 0.72).toFixed(3)})`;
          }

          pincel!.fillStyle = cor;
          pincel!.beginPath();
          pincel!.arc(px, py, raio, 0, Math.PI * 2);
          pincel!.fill();
        }
      }
    }

    function moveu(evento: PointerEvent) {
      const caixa = tela!.getBoundingClientRect();
      rato.alvoX = evento.clientX - caixa.left;
      rato.alvoY = evento.clientY - caixa.top;
    }

    function saiu() {
      rato.alvoX = -9999;
      rato.alvoY = -9999;
    }

    medir();
    const observador = new IntersectionObserver(
      ([entrada]) => {
        visivel = entrada.isIntersecting;
      },
      { rootMargin: "120px" },
    );
    observador.observe(tela);

    const aoRedimensionar = () => medir();
    window.addEventListener("resize", aoRedimensionar);
    window.addEventListener("pointermove", moveu, { passive: true });
    window.addEventListener("pointerleave", saiu);
    pedido = requestAnimationFrame(quadro);

    return () => {
      cancelAnimationFrame(pedido);
      observador.disconnect();
      window.removeEventListener("resize", aoRedimensionar);
      window.removeEventListener("pointermove", moveu);
      window.removeEventListener("pointerleave", saiu);
    };
  }, []);

  return (
    <canvas
      ref={telaRef}
      className={className}
      aria-hidden="true"
      // A malha é decoração: ninguém precisa dela para entender a página.
    />
  );
}

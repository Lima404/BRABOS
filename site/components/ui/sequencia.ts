"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

/**
 * Uma sequência de quadros desenhada num canvas — a técnica das páginas de
 * produto da Apple.
 *
 * Serve à tesoura (que abre e fecha com a rolagem) e à cadeira (que gira
 * com o mouse). Fotorrealista, sem biblioteca de 3D, e liso em celular
 * fraco.
 *
 * Os quadros só começam a baixar quando a seção está a uma tela de
 * distância: quem não rola até lá não paga o download. O primeiro vem
 * sozinho e na frente; o resto vem de quatro em quatro, para não abrir
 * dezenas de conexões de uma vez.
 *
 * `caminhos` precisa ser estável (uma constante de módulo): se mudar a cada
 * render, o download recomeça.
 */
export function useSequencia(
  caminhos: readonly string[],
  vigiaRef: RefObject<HTMLElement | null>,
) {
  const quadrosRef = useRef<(HTMLImageElement | null)[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const vigia = vigiaRef.current;
    if (!vigia) return;

    let vivo = true;
    quadrosRef.current = caminhos.map(() => null);

    const carregar = (indice: number) =>
      new Promise<void>((resolver) => {
        const imagem = new Image();
        imagem.decoding = "async";
        imagem.onload = () => {
          if (vivo) quadrosRef.current[indice] = imagem;
          resolver();
        };
        imagem.onerror = () => resolver();
        imagem.src = caminhos[indice];
      });

    async function baixar() {
      await carregar(0);
      if (!vivo) return;
      setPronto(true);
      for (let i = 1; i < caminhos.length && vivo; i += 4) {
        await Promise.all(
          [i, i + 1, i + 2, i + 3]
            .filter((n) => n < caminhos.length)
            .map(carregar),
        );
      }
    }

    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();
        void baixar();
      },
      { rootMargin: "100% 0px" },
    );
    observador.observe(vigia);

    return () => {
      vivo = false;
      observador.disconnect();
    };
  }, [caminhos, vigiaRef]);

  /**
   * Desenha o quadro `indice` ocupando o canvas inteiro. Se esse quadro
   * ainda não chegou, usa o vizinho mais próximo que já chegou — o
   * movimento fica mais duro por um instante, mas nunca pisca em branco.
   */
  const desenhar = useCallback((tela: HTMLCanvasElement | null, indice: number) => {
    if (!tela) return;
    const quadros = quadrosRef.current;
    let escolhido = quadros[indice] ?? null;
    for (let raio = 1; !escolhido && raio < quadros.length; raio++) {
      escolhido = quadros[indice - raio] ?? quadros[indice + raio] ?? null;
    }
    if (!escolhido) return;

    const pincel = tela.getContext("2d");
    if (!pincel) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const largura = Math.round(tela.clientWidth * dpr);
    const altura = Math.round(tela.clientHeight * dpr);
    if (tela.width !== largura || tela.height !== altura) {
      tela.width = largura;
      tela.height = altura;
    }
    pincel.clearRect(0, 0, largura, altura);
    pincel.drawImage(escolhido, 0, 0, largura, altura);
  }, []);

  return { pronto, desenhar };
}

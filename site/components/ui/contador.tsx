"use client";

import { useEffect, useRef } from "react";

/**
 * Um número que conta de zero até o valor quando entra na tela.
 *
 * A contagem NÃO passa por estado do React: ela escreve direto no nó de
 * texto, sessenta vezes por segundo. Isso resolve três coisas de uma vez —
 * não re-renderiza a página a cada quadro, não dá divergência entre o HTML
 * do servidor e o do navegador, e o valor final já vem escrito no HTML.
 * Quem abre com JavaScript desligado, ou com movimento reduzido, lê o
 * número certo e pronto.
 *
 * Conta uma vez e para. É de propósito que não seja reversível pelo scroll
 * como o resto da página: número subindo e descendo vira ruído, e o que
 * importa aqui é onde ele para.
 */
const FORMATOS = {
  numero: (n: number) => String(Math.round(n)),
  /** Com o ponto do milhar: 10.000, e não 10000. */
  milhar: (n: number) => Math.round(n).toLocaleString("pt-BR"),
  reais: (n: number) =>
    n.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }),
} as const;

export function Contador({
  ate,
  duracao = 1400,
  formato = "numero",
  className,
}: {
  ate: number;
  duracao?: number;
  /**
   * Como escrever o número. É um nome, e não uma função, porque este
   * componente roda no navegador e quem o usa roda no servidor — e função
   * não atravessa essa fronteira.
   */
  formato?: keyof typeof FORMATOS;
  className?: string;
}) {
  const formatar = FORMATOS[formato];
  const movelRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const no = movelRef.current;
    if (!no) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pedido = 0;
    const observador = new IntersectionObserver(
      ([entrada]) => {
        if (!entrada.isIntersecting) return;
        observador.disconnect();

        const comecou = performance.now();
        const passo = (agora: number) => {
          const t = Math.min(1, (agora - comecou) / duracao);
          // Desacelera no fim: o número assenta em vez de parar seco.
          const suave = 1 - Math.pow(1 - t, 3);
          no.textContent = formatar(ate * suave);
          if (t < 1) pedido = requestAnimationFrame(passo);
        };
        pedido = requestAnimationFrame(passo);
      },
      { threshold: 0.4 },
    );
    observador.observe(no);

    return () => {
      observador.disconnect();
      cancelAnimationFrame(pedido);
    };
  }, [ate, duracao, formatar]);

  return (
    <span className={className}>
      {/* O que anima. Fica fora do leitor de tela, senão ele anuncia
          cinquenta números seguidos. */}
      <span ref={movelRef} aria-hidden="true">
        {formatar(ate)}
      </span>
      {/* O que o leitor de tela lê: o valor, uma vez. */}
      <span className="sr-only">{formatar(ate)}</span>
    </span>
  );
}

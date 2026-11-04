"use client";

import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

/**
 * O relógio de uma seção coreografada.
 *
 * Mede o quanto a seção já atravessou a tela e escreve isso na variável CSS
 * `--p` do próprio elemento, de 0 a 1. Todo o resto da coreografia é CSS
 * (ver `.entra` em globals.css) — nenhum filho re-renderiza durante o
 * scroll, o que importa porque a Agenda tem mais de cem pedaços animados.
 *
 * A medição é feita à mão, com `getBoundingClientRect`, e não pelo
 * `useScroll` do motion. O motivo é um defeito que apareceu no teste: ao
 * PULAR para o meio da página (âncora, recarregar no meio, barra de
 * rolagem arrastada), a seção aparecia montada por um instante antes de
 * voltar ao começo da animação. Medindo aqui, o primeiro valor é escrito
 * no mesmo quadro em que o componente monta, e não existe esse intervalo.
 */
export function Cena({
  children,
  className,
  modo = "entrada",
  style,
}: {
  children: ReactNode;
  className?: string;
  /**
   * `presa` — a seção é alta e tem um filho `sticky`: a contagem vai de 0
   * quando o topo dela encosta no topo da tela até 1 quando o fundo dela
   * encosta no fundo da tela.
   *
   * `entrada` — a seção tem altura normal: a contagem começa quando ela
   * assoma na tela e termina quando já está bem instalada.
   */
  modo?: "presa" | "entrada";
  style?: CSSProperties;
}) {
  const alvo = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const no = alvo.current;
    if (!no) return;

    // Quem pediu movimento reduzido não recebe coreografia nenhuma: `--p`
    // fica no valor inicial 1 e a seção nasce montada.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let pedido = 0;
    let ultimo = -1;

    function medir() {
      pedido = 0;
      const caixa = no!.getBoundingClientRect();
      const tela = window.innerHeight;

      let bruto: number;
      if (modo === "presa") {
        const curso = caixa.height - tela;
        bruto = curso > 0 ? -caixa.top / curso : 1;
      } else {
        // Começa quando o topo da seção sobe acima de 85% da tela, e
        // termina quando o fundo dela passa de 60%.
        const comeco = tela * 0.85;
        const fim = tela * 0.6 - caixa.height;
        bruto = (comeco - caixa.top) / (comeco - fim);
      }

      const avanco = Math.min(1, Math.max(0, bruto));
      // Três casas bastam: a diferença abaixo disso não move um pixel, e
      // sem o corte isto escreveria no DOM em todo quadro à toa.
      const arredondado = Math.round(avanco * 1000) / 1000;
      if (arredondado === ultimo) return;
      ultimo = arredondado;
      no!.style.setProperty("--p", String(arredondado));
    }

    function agendar() {
      if (pedido) return;
      pedido = requestAnimationFrame(medir);
    }

    // O primeiro valor sai agora, não no primeiro scroll.
    medir();

    window.addEventListener("scroll", agendar, { passive: true });
    window.addEventListener("resize", agendar);
    return () => {
      cancelAnimationFrame(pedido);
      window.removeEventListener("scroll", agendar);
      window.removeEventListener("resize", agendar);
    };
  }, [modo]);

  return (
    <div ref={alvo} className={className} style={style}>
      {children}
    </div>
  );
}

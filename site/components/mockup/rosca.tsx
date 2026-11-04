import type { CSSProperties } from "react";

import type { Servico } from "@/lib/dados";

/**
 * A rosca do dashboard, desenhada arco por arco conforme a seção entra.
 *
 * O truque é o `pathLength={100}`: ele faz o SVG fingir que a
 * circunferência mede 100, independente do raio de verdade. Com isso cada
 * fatia é literalmente a sua porcentagem, e o `stroke-dasharray` vira
 * aritmética de primeira série em vez de 2·π·r espalhado pelo arquivo.
 */
export function Rosca({
  fatias,
  centro,
  rodape,
  inicio,
}: {
  fatias: readonly Servico[];
  /** O número grande no meio. */
  centro: number;
  rodape: string;
  /** Em que ponto da cena os arcos começam a se desenhar. */
  inicio: number;
}) {
  const total = fatias.reduce((soma, f) => soma + f.quantidade, 0);

  // Onde cada arco começa é a soma dos anteriores. Calculado na hora, sem
  // acumulador mutável — o compilador do React não deixa mexer em variável
  // durante a renderização, e com razão.
  const arcos = fatias.map((fatia, i) => ({
    ...fatia,
    comeco:
      (fatias.slice(0, i).reduce((soma, f) => soma + f.quantidade, 0) / total) *
      100,
    tamanho: (fatia.quantidade / total) * 100,
  }));

  return (
    <div className="relative" style={{ width: "9.5em", height: "9.5em" }}>
      <svg
        viewBox="0 0 100 100"
        className="h-full w-full -rotate-90"
        aria-hidden="true"
      >
        {arcos.map((arco, i) => (
          <circle
            key={arco.nome}
            cx="50"
            cy="50"
            r="40"
            fill="none"
            pathLength={100}
            stroke={arco.cor}
            strokeWidth="13"
            style={
              {
                // Cada arco espera o anterior: a rosca se desenha no
                // sentido do relógio, como o olho espera.
                "--degrau": inicio + i * 0.022,
                "--janela": 0.05,
                "--avanco":
                  "clamp(0, calc((var(--p) - var(--degrau)) / var(--janela)), 1)",
                strokeDasharray: `calc(var(--avanco) * ${arco.tamanho.toFixed(3)}) 200`,
                strokeDashoffset: -arco.comeco,
              } as CSSProperties
            }
          />
        ))}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="numeros font-bold text-white"
          style={{ fontSize: "1.6em" }}
        >
          {centro}
        </span>
        <span style={{ fontSize: "0.68em", color: "var(--fraco)" }}>
          {rodape}
        </span>
      </div>
    </div>
  );
}

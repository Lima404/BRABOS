"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

import { useCoresDoGrafico } from "@/lib/dashboard/cores";
import { cn } from "@/lib/utils";

// O ApexCharts mede o elemento para desenhar, então precisa do navegador.
// `ssr: false` evita o "window is not defined" no build.
const Gráfico = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className="size-56 animate-pulse rounded-full bg-secondary"
    />
  ),
});

export type Fatia = {
  nome: string;
  /** O que define o tamanho da fatia. */
  valor: number;
  /** Linha de apoio na lista — normalmente o dinheiro. */
  detalhe: string;
  cor: string;
};

/**
 * Rosca com a lista ao lado.
 *
 * A lista não é legenda: é o dado. O desenho compara de relance ("cabelo é
 * quase metade"), a lista responde "quanto exatamente" — e é ela que o leitor
 * de tela lê, porque SVG de gráfico não se lê. Por isso o desenho vai como
 * decoração (`aria-hidden`) e nenhum número existe só dentro dele.
 *
 * Rosca e não pizza cheia: o buraco no meio carrega o total, que é a primeira
 * pergunta de quem olha ("de quantos estamos falando?").
 */
export function Rosca({
  titulo,
  descricao,
  fatias,
  totalRotulo,
  vazio,
  className,
}: {
  titulo: string;
  descricao: string;
  fatias: Fatia[];
  /** Palavra sob o número do meio: "atendimentos", "itens". */
  totalRotulo: string;
  vazio: string;
  className?: string;
}) {
  const cores = useCoresDoGrafico();

  const total = useMemo(
    () => fatias.reduce((s, f) => s + f.valor, 0),
    [fatias],
  );

  const opcoes = useMemo(
    () => ({
      chart: {
        type: "donut" as const,
        background: "transparent",
        fontFamily: "inherit",
        animations: { speed: 300 },
        // A barra de ferramentas do Apex (zoom, download) não faz sentido
        // numa rosca e ainda rouba o canto do desenho.
        toolbar: { show: false },
      },
      labels: fatias.map((f) => f.nome),
      colors: fatias.map((f) => f.cor),
      legend: { show: false },
      dataLabels: { enabled: false },
      // O traço da cor do cartão separa fatias vizinhas de tom parecido.
      stroke: { width: 2, colors: [cores.fundo] },
      plotOptions: {
        pie: {
          donut: {
            size: "68%",
            labels: {
              show: true,
              value: {
                fontSize: "1.75rem",
                fontWeight: 700,
                color: cores.texto,
                offsetY: 4,
              },
              total: {
                show: true,
                label: totalRotulo,
                fontSize: "0.75rem",
                fontWeight: 600,
                color: cores.texto,
                formatter: () => String(total),
              },
            },
          },
        },
      },
      tooltip: {
        // Tooltip próprio: o do Apex traz a paleta dele, que no tema escuro
        // vira caixa branca sobre fundo preto.
        custom: ({ seriesIndex }: { seriesIndex: number }) => {
          const f = fatias[seriesIndex];
          if (!f) return "";
          return `<div style="padding:8px 10px;background:${cores.fundo};color:${cores.texto};border:1px solid ${cores.borda};border-radius:8px;font-size:12px;line-height:1.5">
            <strong style="color:${f.cor}">${escapar(f.nome)}</strong><br/>
            ${f.valor} · ${escapar(f.detalhe)}
          </div>`;
        },
      },
      // Sem escurecer a fatia clicada: no toque do celular ela ficaria
      // presa no estado ativo depois que o dedo sai.
      states: { active: { filter: { type: "none" as const } } },
    }),
    [fatias, cores, total, totalRotulo],
  );

  const series = useMemo(() => fatias.map((f) => f.valor), [fatias]);

  return (
    <section
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5",
        className,
      )}
    >
      <header>
        <h2 className="font-semibold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{descricao}</p>
      </header>

      {fatias.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{vazio}</p>
      ) : (
        <div className="flex flex-col items-center gap-5 lg:flex-row lg:items-center">
          <div aria-hidden="true" className="w-full max-w-64 shrink-0">
            <Gráfico options={opcoes} series={series} type="donut" width="100%" />
          </div>

          <ul className="flex w-full min-w-0 flex-col gap-1">
            {fatias.map((f) => (
              <li
                key={f.nome}
                className="flex items-center gap-3 border-b border-border py-2 last:border-b-0"
              >
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: f.cor }}
                />
                <span className="min-w-0 flex-1 truncate">{f.nome}</span>
                <span data-numero className="shrink-0 font-semibold">
                  {f.valor}
                </span>
                <span
                  data-numero
                  className="w-24 shrink-0 text-right text-sm text-muted-foreground"
                >
                  {f.detalhe}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** O nome do produto vem do banco e vai pra dentro de HTML montado à mão. */
function escapar(texto: string): string {
  return texto
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

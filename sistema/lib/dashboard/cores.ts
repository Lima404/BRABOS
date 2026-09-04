"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

import { CORES_SERVICO, type CorServico } from "@/lib/agenda/tipos";

/**
 * As cores dos gráficos, lidas dos tokens do CSS.
 *
 * O ApexCharts desenha em SVG e quer o valor da cor em mão — não aceita
 * `var(--serv-azul)`. Em vez de repetir os hexadecimais aqui (que é como a
 * paleta do gráfico começa a divergir da paleta da agenda no primeiro
 * ajuste), a gente LÊ do `:root` em tempo de execução. Uma fonte da verdade,
 * `app/globals.css`, para os dois.
 *
 * Relê a cada troca de tema: claro e escuro têm hexadecimais diferentes para
 * o mesmo nome de cor, e sem isto o gráfico ficaria com a paleta clara sobre
 * fundo escuro.
 */

export type CoresDoGrafico = {
  /** Um hexadecimal por nome da paleta, na ordem de `CORES_SERVICO`. */
  paleta: string[];
  porNome: Record<CorServico, string>;
  texto: string;
  borda: string;
  fundo: string;
  primaria: string;
  /** Segunda série do comparativo de meses (a loja). */
  secundaria: string;
};

const RESERVA: CoresDoGrafico = {
  paleta: ["#1b4fbf", "#146c45", "#5b3bb8", "#0f6675", "#a32463", "#5b6472"],
  porNome: {
    azul: "#1b4fbf",
    verde: "#146c45",
    violeta: "#5b3bb8",
    ciano: "#0f6675",
    rosa: "#a32463",
    grafite: "#5b6472",
  },
  texto: "#5b6472",
  borda: "#c9cfd8",
  fundo: "#ffffff",
  primaria: "#f0a93b",
  secundaria: "#0f6675",
};

export function useCoresDoGrafico(): CoresDoGrafico {
  const { resolvedTheme } = useTheme();
  // Começa na reserva (tema claro) porque o primeiro render acontece antes de
  // qualquer efeito. Sem isso o gráfico nasceria sem cor nenhuma e piscaria.
  const [cores, setCores] = useState<CoresDoGrafico>(RESERVA);

  useEffect(() => {
    const estilo = getComputedStyle(document.documentElement);
    const ler = (nome: string, reserva: string) =>
      estilo.getPropertyValue(nome).trim() || reserva;

    const porNome = Object.fromEntries(
      CORES_SERVICO.map((nome) => [
        nome,
        ler(`--serv-${nome}`, RESERVA.porNome[nome]),
      ]),
    ) as Record<CorServico, string>;

    setCores({
      paleta: CORES_SERVICO.map((nome) => porNome[nome]),
      porNome,
      texto: ler("--muted-foreground", RESERVA.texto),
      borda: ler("--border", RESERVA.borda),
      fundo: ler("--card", RESERVA.fundo),
      primaria: ler("--primary", RESERVA.primaria),
      secundaria: ler("--serv-ciano", RESERVA.secundaria),
    });
  }, [resolvedTheme]);

  return cores;
}

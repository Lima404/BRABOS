"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { useCoresDoGrafico } from "@/lib/dashboard/cores";
import {
  extremosDoHistorico,
  mediaMensal,
  totalDoMes,
  type MesNoHistorico,
} from "@/lib/dashboard/tipos";
import { mesCurto, mesPorExtenso, moeda, moedaCurta } from "@/lib/formato";

/**
 * Largura da coluna, em porcentagem da faixa de cada mês.
 *
 * O ApexCharts só aceita porcentagem, e porcentagem com poucos meses é
 * armadilha: 55% de uma faixa que ocupa a tela inteira vira um bloco de meio
 * metro, que grita mas não compara com nada. Quanto menos mês, mais estreita
 * a coluna — assim a primeira barra do histórico tem a mesma cara que ela
 * terá quando houver doze.
 */
function larguraDaColuna(quantidade: number): string {
  if (quantidade <= 1) return "12%";
  if (quantidade <= 2) return "22%";
  if (quantidade <= 4) return "38%";
  if (quantidade <= 12) return "55%";
  return "80%";
}

const Gráfico = dynamic(() => import("react-apexcharts"), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      aria-label="Carregando gráfico"
      className="h-72 w-full animate-pulse rounded-lg bg-secondary"
    />
  ),
});

/**
 * Todos os meses lado a lado.
 *
 * Coluna, não pizza: pizza responde "que fatia do todo", e aqui a pergunta é
 * "qual mês foi maior que qual" — comparação de grandeza, que o olho faz por
 * altura e não por ângulo.
 *
 * Empilhada em serviço e loja porque um mês pode crescer por dois motivos
 * diferentes, e a coluna inteira sozinha esconderia qual dos dois foi.
 *
 * Mês sem movimento aparece como coluna zero, e não sumido: buraco fechado
 * faria dezembro encostar em fevereiro e contar uma continuidade que não
 * houve.
 */
export function ComparativoMeses({ meses }: { meses: MesNoHistorico[] }) {
  const cores = useCoresDoGrafico();

  const { melhor, pior } = useMemo(() => extremosDoHistorico(meses), [meses]);
  const media = useMemo(() => mediaMensal(meses), [meses]);

  // Melhor e pior sendo o mesmo mês = só um mês teve movimento.
  const unicoMes = melhor && pior && melhor.mes === pior.mes ? melhor : null;

  const opcoes = useMemo(
    () => ({
      chart: {
        type: "bar" as const,
        stacked: true,
        background: "transparent",
        fontFamily: "inherit",
        toolbar: { show: false },
        animations: { speed: 300 },
        zoom: { enabled: false },
      },
      colors: [cores.primaria, cores.secundaria],
      plotOptions: {
        bar: {
          columnWidth: larguraDaColuna(meses.length),
          borderRadius: 4,
          borderRadiusApplication: "end" as const,
        },
      },
      dataLabels: { enabled: false },
      stroke: { width: 0 },
      grid: {
        borderColor: cores.borda,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
      },
      xaxis: {
        categories: meses.map((m) => mesCurto(m.mes)),
        labels: { style: { colors: cores.texto, fontSize: "12px" } },
        axisBorder: { color: cores.borda },
        axisTicks: { color: cores.borda },
      },
      yaxis: {
        labels: {
          formatter: (v: number) => moedaCurta(v),
          style: { colors: cores.texto, fontSize: "12px" },
        },
      },
      legend: {
        position: "top" as const,
        horizontalAlign: "left" as const,
        labels: { colors: cores.texto },
        markers: { size: 6 },
        itemMargin: { horizontal: 10 },
      },
      tooltip: {
        // Igual à rosca: o tooltip nativo traz a paleta do Apex e vira caixa
        // branca sobre fundo preto no tema escuro.
        custom: ({ dataPointIndex }: { dataPointIndex: number }) => {
          const m = meses[dataPointIndex];
          if (!m) return "";
          return `<div style="padding:8px 10px;background:${cores.fundo};color:${cores.texto};border:1px solid ${cores.borda};border-radius:8px;font-size:12px;line-height:1.6">
            <strong>${mesPorExtenso(m.mes)}</strong><br/>
            Serviço ${moeda(m.servicoCentavos)}<br/>
            Loja ${moeda(m.lojaCentavos)}<br/>
            <strong>Total ${moeda(totalDoMes(m))}</strong>
          </div>`;
        },
      },
      // Sem escurecer a fatia clicada: no toque do celular ela ficaria
      // presa no estado ativo depois que o dedo sai.
      states: { active: { filter: { type: "none" as const } } },
    }),
    [meses, cores],
  );

  const series = useMemo(
    () => [
      { name: "Serviço", data: meses.map((m) => m.servicoCentavos) },
      { name: "Loja", data: meses.map((m) => m.lojaCentavos) },
    ],
    [meses],
  );

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
      <header>
        <h2 className="font-semibold">Mês a mês</h2>
        <p className="text-sm text-muted-foreground">
          Todo o histórico, do primeiro movimento até agora.
        </p>
      </header>

      {meses.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Ainda não há mês fechado para comparar. Conclua atendimentos e eles
          aparecem aqui.
        </p>
      ) : (
        <>
          {/* Com um mês só, "mais forte", "mais fraco" e "média" são o mesmo
              número escrito três vezes — o que parece defeito mesmo estando
              certo. Aí a tela diz o que de fato sabe: ainda não dá pra
              comparar. */}
          {unicoMes ? (
            <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Único mês com movimento
              </span>
              <span data-numero className="text-lg font-bold">
                {moeda(totalDoMes(unicoMes))}
              </span>
              <span className="text-sm text-muted-foreground">
                {mesPorExtenso(unicoMes.mes)} — a comparação começa a valer com
                o segundo mês.
              </span>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              <Destaque
                icone={TrendingUp}
                rotulo="Mês mais forte"
                mes={melhor}
                tom="bom"
              />
              <Destaque
                icone={TrendingDown}
                rotulo="Mês mais fraco"
                mes={pior}
                tom="fraco"
              />
              <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
                <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Média por mês
                </span>
                <span data-numero className="text-lg font-bold">
                  {moeda(media)}
                </span>
                <span className="text-sm text-muted-foreground">
                  Só meses com movimento
                </span>
              </div>
            </div>
          )}

          {/* O desenho é a comparação; os números exatos estão nos destaques
              acima e no tooltip. Por isso ele vai como decoração. */}
          <div aria-hidden="true" className="w-full">
            <Gráfico
              options={opcoes}
              series={series}
              type="bar"
              height={300}
              width="100%"
            />
          </div>
        </>
      )}
    </section>
  );
}

function Destaque({
  icone: Icone,
  rotulo,
  mes,
  tom,
}: {
  icone: typeof TrendingUp;
  rotulo: string;
  mes?: MesNoHistorico;
  tom: "bom" | "fraco";
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-border p-3">
      <span className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <Icone
          className={
            tom === "bom" ? "size-3.5 text-confirmado" : "size-3.5 text-faltou"
          }
          aria-hidden="true"
        />
        {rotulo}
      </span>

      {mes ? (
        <>
          <span data-numero className="text-lg font-bold">
            {moeda(totalDoMes(mes))}
          </span>
          <span className="text-sm text-muted-foreground">
            {mesPorExtenso(mes.mes)}
          </span>
        </>
      ) : (
        <span className="py-1 text-sm text-muted-foreground">
          Ainda não dá pra dizer.
        </span>
      )}
    </div>
  );
}

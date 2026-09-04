"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DIAS_SEMANA } from "@/lib/agenda/tipos";
import { dataISO, mesISO, mesPorExtenso } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Um mês de calendário do tamanho de um bloco — para escolher datas dentro de
 * um formulário, não para navegar a agenda.
 *
 * Não é o `CalendarioFC`: aquele desenha eventos, rola o mês e ocupa a tela.
 * Este é um seletor. Tentar reusar o FullCalendar aqui traria a folha de
 * estilo dele inteira para dentro de um modal.
 *
 * Cada dia é um `aria-pressed` de verdade, e não uma célula pintada: quem usa
 * leitor de tela ouve "5 de setembro, pressionado" e sabe o que o toque fez.
 */
export function MiniCalendario({
  mes,
  aoMudarMes,
  marcados,
  aoAlternar,
  minimo,
  hoje,
  desabilitado = false,
}: {
  /** AAAA-MM — o mês visível. */
  mes: string;
  aoMudarMes: (mes: string) => void;
  /** Datas AAAA-MM-DD já marcadas. */
  marcados: Set<string>;
  aoAlternar: (data: string) => void;
  /** AAAA-MM-DD — antes disso não dá para marcar. */
  minimo?: string;
  /** AAAA-MM-DD do relógio da barbearia, para o anel de "hoje". */
  hoje?: string;
  desabilitado?: boolean;
}) {
  const [ano, m] = mes.split("-").map(Number);

  // `new Date(ano, m, 0)` é o último dia do mês anterior ao índice `m`, ou
  // seja, o último dia do mês `m-1` — o que estamos mostrando.
  const totalDeDias = new Date(ano, m, 0).getDate();
  const primeiroDiaDaSemana = new Date(ano, m - 1, 1).getDay();

  const dias: (string | null)[] = [
    // Buracos antes do dia 1, para a semana começar na coluna certa. Vazio e
    // não o dia do mês passado: aqui não se marca folga de outro mês sem
    // navegar até ele — clicar num "31" que pertence a agosto seria armadilha.
    ...Array.from({ length: primeiroDiaDaSemana }, () => null),
    ...Array.from({ length: totalDeDias }, (_, i) =>
      dataISO(new Date(ano, m - 1, i + 1)),
    ),
  ];

  function passo(direcao: -1 | 1) {
    aoMudarMes(mesISO(new Date(ano, m - 1 + direcao, 1)));
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => passo(-1)}
          aria-label="Mês anterior"
        >
          <ChevronLeft />
        </Button>

        <p aria-live="polite" className="text-sm font-semibold">
          {mesPorExtenso(mes)}
        </p>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => passo(1)}
          aria-label="Próximo mês"
        >
          <ChevronRight />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <abbr
            key={d.numero}
            title={d.nome}
            className="pb-1 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase no-underline"
          >
            {d.curto}
          </abbr>
        ))}

        {dias.map((data, i) => {
          if (!data) return <span key={`vazio-${i}`} aria-hidden="true" />;

          const folga = marcados.has(data);
          const passou = minimo !== undefined && data < minimo;
          const ehHojeAqui = data === hoje;

          return (
            <button
              key={data}
              type="button"
              disabled={desabilitado || passou}
              aria-pressed={folga}
              aria-label={rotuloDoDia(data, folga)}
              onClick={() => aoAlternar(data)}
              className={cn(
                "min-h-11 rounded-md text-sm font-medium tabular-nums transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                "disabled:cursor-not-allowed disabled:opacity-35",
                folga
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-foreground hover:bg-secondary",
                // Hoje é anel, não fundo: fundo disputaria com o âmbar da
                // folga, e um dia pode ser as duas coisas.
                ehHojeAqui && "ring-2 ring-ring ring-inset",
              )}
            >
              {Number(data.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** "5 de setembro — folga marcada". O leitor de tela não vê o âmbar. */
function rotuloDoDia(data: string, folga: boolean): string {
  const texto = new Date(`${data}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return folga ? `${texto} — folga marcada` : texto;
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import ptBr from "@fullcalendar/core/locales/pt-br";
import type { EventContentArg } from "@fullcalendar/core";

import {
  CLASSES_SERVICO,
  fimLocal,
  inicioLocal,
  type Agendamento,
  type ConfiguracaoAgenda,
} from "@/lib/agenda/tipos";
import { dataISO } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * O calendário. Só o grid — barra de navegação, legenda e painel do dia são
 * componentes irmãos, orquestrados por components/agenda/agenda.tsx.
 *
 * A `headerToolbar` do FullCalendar está desligada de propósito: a barra dele
 * não segue a identidade da marca nem os 44px de alvo de toque. A nossa está
 * em `barra-superior.tsx`.
 */
export function CalendarioFC({
  mes,
  agendamentos,
  diaSelecionado,
  aoSelecionarDia,
  aoMudarMes,
  configuracao,
}: {
  /** AAAA-MM — o mês que deve estar visível. */
  mes: string;
  agendamentos: Agendamento[];
  /** AAAA-MM-DD */
  diaSelecionado: string;
  aoSelecionarDia: (dia: string) => void;
  aoMudarMes: (mes: string) => void;
  /** Dias e horário de atendimento — sombreiam os dias fechados. */
  configuracao: ConfiguracaoAgenda;
}) {
  const ref = useRef<FullCalendar>(null);

  // A navegação de mês mora no React (barra-superior). Aqui só mandamos o
  // FullCalendar acompanhar — ele tem calendário interno próprio.
  useEffect(() => {
    const api = ref.current?.getApi();
    if (!api) return;

    const [ano, m] = mes.split("-").map(Number);
    const visivel = api.getDate();
    if (visivel.getFullYear() !== ano || visivel.getMonth() !== m - 1) {
      api.gotoDate(new Date(ano, m - 1, 1));
    }
  }, [mes]);

  const eventos = useMemo(
    () =>
      agendamentos.map((a) => ({
        id: a.id,
        title: a.clienteNome,
        start: inicioLocal(a),
        end: fimLocal(a),
        extendedProps: { agendamento: a },
      })),
    [agendamentos],
  );

  return (
    <div className="calendario-barbos overflow-hidden rounded-lg border border-border bg-card">
      <FullCalendar
        ref={ref}
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={ptBr}
        headerToolbar={false}
        height="auto"
        firstDay={0}
        fixedWeekCount={false}
        dayMaxEvents={3}
        moreLinkContent={(arg) => `+${arg.num} mais`}
        events={eventos}
        // Dia fechado nao some da grade: some seria mentira (o mes tem aquele
        // dia). Ele fica sombreado, e o `.fc-non-business` do globals.css
        // desenha a faixa diagonal — nunca so o cinza.
        businessHours={{
          daysOfWeek: configuracao.diasAtendimento,
          startTime: configuracao.abre,
          endTime: configuracao.fecha,
        }}
        // Sempre HH:MM. O padrão do FullCalendar omite os minutos zerados
        // ("09" ao lado de "09:30"), o que desalinha a coluna de horário —
        // justamente a que o barbeiro percorre com o olho.
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        // O dia selecionado é marcado por classe, não por cor inline: assim
        // respeita o tema claro e o escuro sem duplicar valor.
        dayCellClassNames={(arg) =>
          dataISO(arg.date) === diaSelecionado ? ["dia-selecionado"] : []
        }
        dateClick={(info) => aoSelecionarDia(info.dateStr)}
        eventClick={(info) => {
          const inicio = info.event.start;
          if (inicio) aoSelecionarDia(dataISO(inicio));
        }}
        datesSet={(info) => {
          // `info.start` é o começo da grade (pode cair no mês anterior).
          // O meio da grade sempre pertence ao mês exibido.
          const meio = new Date(
            (info.start.getTime() + info.end.getTime()) / 2,
          );
          const novo = `${meio.getFullYear()}-${String(meio.getMonth() + 1).padStart(2, "0")}`;
          if (novo !== mes) aoMudarMes(novo);
        }}
        eventContent={conteudoDoEvento}
      />
    </div>
  );
}

/** Evento: bolinha da cor do serviço + horário + nome do cliente. */
function conteudoDoEvento(arg: EventContentArg) {
  const a = arg.event.extendedProps.agendamento as Agendamento | undefined;
  if (!a) return null;

  const c = CLASSES_SERVICO[a.servico.cor];
  const cancelado = a.estado === "cancelado";

  return (
    <div
      title={`${arg.timeText} · ${a.clienteNome} · ${a.servico.nome}`}
      className={cn(
        "flex w-full items-center gap-1.5 overflow-hidden rounded px-1.5 py-0.5 text-xs",
        c.fundo,
        c.texto,
        cancelado && "line-through opacity-70",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", c.pontoBg)}
      />
      <span data-numero className="shrink-0 font-semibold">
        {arg.timeText}
      </span>
      <span className="truncate">{a.clienteNome}</span>
    </div>
  );
}

"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import type { Barbeiro } from "@/lib/barbearia/tipos";
import { mesPorExtenso } from "@/lib/formato";

/**
 * Navegacao do calendario. Substitui a headerToolbar do FullCalendar, que nao
 * segue a marca nem os 44px de alvo de toque.
 *
 * À direita: seletor de barbeiro (agenda própria), configurar, novo horário.
 */
export function BarraSuperior({
  mes,
  aoIrParaHoje,
  aoMudarMes,
  aoConfigurar,
  aoNovoAgendamento,
  totalNoMes,
  barbeiros,
  barbeiroId,
  aoMudarBarbeiro,
}: {
  mes: string;
  aoIrParaHoje: () => void;
  aoMudarMes: (passo: -1 | 1) => void;
  aoConfigurar: () => void;
  aoNovoAgendamento: () => void;
  totalNoMes: number;
  barbeiros: Barbeiro[];
  /** `null` = ainda sem escolha (lista vazia ou carregando). */
  barbeiroId: string | null;
  aoMudarBarbeiro: (id: string) => void;
}) {
  const semEquipe = barbeiros.length === 0;

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="secondary" onClick={aoIrParaHoje}>
          Hoje
        </Button>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => aoMudarMes(-1)}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </Button>

          {/* aria-live: quem usa leitor de tela ouve o mês mudar */}
          <h2
            aria-live="polite"
            className="min-w-[10.5rem] text-center text-lg font-semibold"
          >
            {mesPorExtenso(mes)}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => aoMudarMes(1)}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </Button>
        </div>

        <span className="hidden text-sm text-muted-foreground sm:inline">
          <span data-numero>{totalNoMes}</span>{" "}
          {totalNoMes === 1 ? "agendamento" : "agendamentos"}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Select
          value={barbeiroId ?? undefined}
          onValueChange={aoMudarBarbeiro}
          disabled={semEquipe}
        >
          <SelectGatilho
            aria-label="Barbeiro da agenda"
            className="w-36"
          >
            <SelectValor
              placeholder={
                semEquipe ? "Cadastre um barbeiro" : "Barbeiro"
              }
            />
          </SelectGatilho>
          <SelectConteudo>
            {barbeiros.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nome}
              </SelectItem>
            ))}
          </SelectConteudo>
        </Select>

        {/* Mesmo tamanho do CTA (48px), sem o âmbar: configurar é ajuste raro,
            marcar horário é o que a pessoa veio fazer. Um âmbar por tela. */}
        <Button
          variant="outline"
          size="icon-lg"
          onClick={aoConfigurar}
          aria-label="Configurar agenda"
          title="Configurar agenda"
        >
          <Settings />
        </Button>

        {/* O unico botao ambar da tela. */}
        <Button
          size="lg"
          className="hidden sm:inline-flex"
          onClick={aoNovoAgendamento}
        >
          <CalendarPlus />
          Novo agendamento
        </Button>
      </div>
    </div>
  );
}

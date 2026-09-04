"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Link2,
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
  aoCriarLink,
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
  /** Ausente = conta sem barbearia, então não há endereço para mostrar. */
  aoCriarLink?: () => void;
  aoNovoAgendamento: () => void;
  totalNoMes: number;
  barbeiros: Barbeiro[];
  /** `null` = ainda sem escolha (lista vazia ou carregando). */
  barbeiroId: string | null;
  aoMudarBarbeiro: (id: string) => void;
}) {
  const semEquipe = barbeiros.length === 0;

  return (
    // Duas linhas até `lg`, uma só a partir dali.
    //
    // Tudo numa linha só pede ~880px: "Hoje" + setas + mês + contagem já
    // passam de 450, e barbeiro + configurar + o botão âmbar passam de 400.
    // No celular isso não cabia, e como o grupo da direita era `shrink-0` e o
    // mês tinha largura mínima fixa, ninguém cedia — o nome do mês ficava
    // por baixo do seletor.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="secondary" className="shrink-0" onClick={aoIrParaHoje}>
          Hoje
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => aoMudarMes(-1)}
            aria-label="Mês anterior"
          >
            <ChevronLeft />
          </Button>

          {/* aria-live: quem usa leitor de tela ouve o mês mudar.
              No celular ele ocupa a sobra entre as setas; de `sm` pra cima
              volta à largura fixa, que impede a linha de dançar quando o mês
              troca de "Maio" para "Setembro". */}
          <h2
            aria-live="polite"
            className="min-w-0 flex-1 truncate text-center text-base font-semibold whitespace-nowrap sm:min-w-[10.5rem] sm:flex-none sm:text-lg"
          >
            {mesPorExtenso(mes)}
          </h2>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => aoMudarMes(1)}
            aria-label="Próximo mês"
          >
            <ChevronRight />
          </Button>
        </div>

        <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
          <span data-numero>{totalNoMes}</span>{" "}
          {totalNoMes === 1 ? "agendamento" : "agendamentos"}
        </span>
      </div>

      <div className="flex items-center gap-2 lg:shrink-0">
        {/* O seletor ocupa a sobra da linha no celular e vira largura fixa no
            desktop. O invólucro é quem manda: o gatilho do Select já nasce
            `w-full` e preenche o que sobrar. */}
        <div className="min-w-0 flex-1 lg:w-44 lg:flex-none">
          <Select
            value={barbeiroId ?? undefined}
            onValueChange={aoMudarBarbeiro}
            disabled={semEquipe}
          >
            <SelectGatilho aria-label="Barbeiro da agenda">
              <SelectValor
                placeholder={semEquipe ? "Cadastre um barbeiro" : "Barbeiro"}
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
        </div>

        {/* Some quando a conta não tem barbearia: sem apelido não há
            endereço, e um botão que abre um link quebrado é pior que
            nenhum botão. */}
        {aoCriarLink ? (
          <Button
            variant="outline"
            size="icon-lg"
            className="shrink-0"
            onClick={aoCriarLink}
            aria-label="Link de agendamento online"
            title="Link de agendamento online"
          >
            <Link2 />
          </Button>
        ) : null}

        {/* Mesmo tamanho do CTA (48px), sem o âmbar: configurar é ajuste raro,
            marcar horário é o que a pessoa veio fazer. Um âmbar por tela. */}
        <Button
          variant="outline"
          size="icon-lg"
          className="shrink-0"
          onClick={aoConfigurar}
          aria-label="Configurar agenda"
          title="Configurar agenda"
        >
          <Settings />
        </Button>

        {/* O unico botao ambar da tela. */}
        <Button
          size="lg"
          className="hidden shrink-0 sm:inline-flex"
          onClick={aoNovoAgendamento}
        >
          <CalendarPlus />
          Novo agendamento
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Campo, Opcao } from "@/components/ui/campo";
import { Input, InputDeTempo } from "@/components/ui/input";
import { RadioGrupo, RadioItem } from "@/components/ui/radio";
import type { PeriodoDoFiltro, PeriodoFiltro } from "@/lib/dashboard/filtros";

/**
 * A seção "Período" dos filtros: dia, semana, mês, ano ou início e fim.
 *
 * Mora fora do diálogo do dashboard porque o Painel Admin usa a mesma
 * escolha de datas. Genérica de propósito: devolve o filtro inteiro de
 * quem chamou (com serviços ou com barbearias), mexendo só nas datas.
 */
export function PainelPeriodo<T extends PeriodoDoFiltro>({
  valor,
  aoMudar,
}: {
  valor: T;
  aoMudar: (f: T) => void;
}) {
  function setPeriodo(periodo: PeriodoFiltro) {
    aoMudar({ ...valor, periodo });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Período</h3>
        <p className="text-sm text-muted-foreground">
          Dia, semana, mês, ano ou um intervalo entre duas datas.
        </p>
      </div>

      <RadioGrupo
        value={valor.periodo}
        onValueChange={(v) => setPeriodo(v as PeriodoFiltro)}
        className="grid grid-cols-2 gap-1 sm:grid-cols-3"
      >
        <Opcao
          htmlFor="filtro-periodo-dia"
          rotulo="Dia"
          controle={<RadioItem id="filtro-periodo-dia" value="dia" />}
        />
        <Opcao
          htmlFor="filtro-periodo-semana"
          rotulo="Semana"
          controle={<RadioItem id="filtro-periodo-semana" value="semana" />}
        />
        <Opcao
          htmlFor="filtro-periodo-mes"
          rotulo="Mês"
          controle={<RadioItem id="filtro-periodo-mes" value="mes" />}
        />
        <Opcao
          htmlFor="filtro-periodo-ano"
          rotulo="Ano"
          controle={<RadioItem id="filtro-periodo-ano" value="ano" />}
        />
        <Opcao
          htmlFor="filtro-periodo-intervalo"
          rotulo="Início e fim"
          className="sm:col-span-2"
          controle={
            <RadioItem id="filtro-periodo-intervalo" value="intervalo" />
          }
        />
      </RadioGrupo>

      {valor.periodo === "dia" ? (
        <Campo rotulo="Data">
          <InputDeTempo
            type="date"
            value={valor.dataInicio}
            onChange={(e) =>
              aoMudar({ ...valor, dataInicio: e.target.value, dataFim: "" })
            }
          />
        </Campo>
      ) : null}

      {valor.periodo === "semana" ? (
        <Campo rotulo="Semana" ajuda="Escolha qualquer dia da semana desejada.">
          <InputDeTempo
            type="week"
            value={valor.semana}
            onChange={(e) => aoMudar({ ...valor, semana: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "mes" ? (
        <Campo rotulo="Mês">
          <InputDeTempo
            type="month"
            value={valor.mes}
            onChange={(e) => aoMudar({ ...valor, mes: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "ano" ? (
        <Campo rotulo="Ano">
          <Input
            type="number"
            inputMode="numeric"
            min={2020}
            max={2100}
            value={valor.ano}
            onChange={(e) => aoMudar({ ...valor, ano: e.target.value })}
          />
        </Campo>
      ) : null}

      {valor.periodo === "intervalo" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Data início">
            <InputDeTempo
              type="date"
              value={valor.dataInicio}
              onChange={(e) =>
                aoMudar({ ...valor, dataInicio: e.target.value })
              }
            />
          </Campo>
          <Campo rotulo="Data fim">
            <InputDeTempo
              type="date"
              value={valor.dataFim}
              onChange={(e) => aoMudar({ ...valor, dataFim: e.target.value })}
            />
          </Campo>
        </div>
      ) : null}
    </div>
  );
}

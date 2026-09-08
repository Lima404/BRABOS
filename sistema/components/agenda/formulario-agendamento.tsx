"use client";

import type { DadosAgendamento } from "@/app/(sistema)/agenda/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Campo } from "@/components/ui/campo";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CLASSES_SERVICO, type Servico } from "@/lib/agenda/tipos";
import type { Barbeiro } from "@/lib/barbearia/tipos";
import {
  duracaoPorExtenso,
  moeda,
  sanitizarNome,
  sanitizarTextoLivre,
} from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * O botão de salvar mora no rodapé do modal, fora deste `<form>`, e se liga a
 * ele por `form={ID_FORMULARIO_AGENDAMENTO}`. Se mudar aqui, muda lá.
 */
export const ID_FORMULARIO_AGENDAMENTO = "formulario-agendamento";

function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hhmmDe(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Coluna da esquerda do modal — campos do agendamento.
 *
 * Estado controlado pelo diálogo pai para a linha do tempo acompanhar data,
 * horário e duração do serviço em tempo real.
 */
export function FormularioAgendamento({
  clienteNome,
  aoMudarClienteNome,
  barbeiroId,
  aoMudarBarbeiroId,
  barbeiros,
  servicoId,
  aoMudarServicoId,
  data,
  aoMudarData,
  horario,
  aoMudarHorario,
  observacao,
  aoMudarObservacao,
  servicos,
  erro,
  aoSalvar,
}: {
  clienteNome: string;
  aoMudarClienteNome: (v: string) => void;
  barbeiroId: string;
  aoMudarBarbeiroId: (v: string) => void;
  barbeiros: Barbeiro[];
  servicoId: string;
  aoMudarServicoId: (v: string) => void;
  data: string;
  aoMudarData: (v: string) => void;
  horario: string;
  aoMudarHorario: (v: string) => void;
  observacao: string;
  aoMudarObservacao: (v: string) => void;
  servicos: Servico[];
  erro: string | null;
  aoSalvar: (dados: DadosAgendamento) => void;
}) {
  const escolhido = servicos.find((s) => s.id === servicoId);
  const fim =
    horario && escolhido
      ? hhmmDe(minutosDe(horario) + escolhido.duracaoMin)
      : "";

  function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    aoSalvar({
      clienteNome,
      barbeiroId,
      servicoId,
      data,
      horario,
      observacao: observacao.trim() || undefined,
    });
  }

  return (
    <form
      id={ID_FORMULARIO_AGENDAMENTO}
      onSubmit={enviar}
      className="flex flex-col gap-5"
    >
      <Campo id="agendamento-cliente" rotulo="Cliente">
        <Input
          value={clienteNome}
          onChange={(e) => aoMudarClienteNome(sanitizarNome(e.target.value))}
          placeholder="Nome do cliente"
          maxLength={80}
          required
          autoFocus
        />
      </Campo>

      <Campo id="agendamento-barbeiro" rotulo="Barbeiro">
        {barbeiros.length === 0 ? (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            Cadastre um barbeiro em Barbearia antes de marcar horário.
          </p>
        ) : (
          <Select value={barbeiroId} onValueChange={aoMudarBarbeiroId}>
            <SelectGatilho>
              <SelectValor placeholder="Quem atende" />
            </SelectGatilho>
            <SelectConteudo>
              {barbeiros.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nome}
                </SelectItem>
              ))}
            </SelectConteudo>
          </Select>
        )}
      </Campo>

      <Campo id="agendamento-servico" rotulo="Serviço">
        {servicos.length === 0 ? (
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            Cadastre um serviço em Configurar agenda antes de marcar horário.
          </p>
        ) : (
          <Select value={servicoId} onValueChange={aoMudarServicoId}>
            <SelectGatilho>
              <SelectValor placeholder="Escolha o serviço" />
            </SelectGatilho>
            <SelectConteudo>
              {servicos.map((s) => {
                const c = CLASSES_SERVICO[s.cor];
                return (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          c.pontoBg,
                        )}
                      />
                      <span className="truncate">{s.nome}</span>
                      <span className="text-muted-foreground">
                        · {moeda(s.precoCentavos)} ·{" "}
                        {duracaoPorExtenso(s.duracaoMin)}
                      </span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectConteudo>
          </Select>
        )}
      </Campo>

      {/* Uma linha como na referência: data + início + fim calculado. */}
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm leading-none font-medium">
          Data e horário
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.85fr)_minmax(0,0.85fr)]">
          <Input
            id="agendamento-data"
            type="date"
            value={data}
            onChange={(e) => aoMudarData(e.target.value)}
            aria-label="Data"
            required
          />
          <Input
            id="agendamento-horario"
            type="time"
            value={horario}
            onChange={(e) => aoMudarHorario(e.target.value)}
            aria-label="Horário de início"
            step={900}
            required
          />
          <Input
            id="agendamento-fim"
            type="time"
            value={fim}
            aria-label={
              escolhido
                ? `Fim (${duracaoPorExtenso(escolhido.duracaoMin)})`
                : "Horário de fim"
            }
            disabled
            readOnly
            tabIndex={-1}
          />
        </div>
        {escolhido ? (
          <p className="text-sm text-muted-foreground">
            Fim calculado pela duração do serviço (
            <span data-numero>{duracaoPorExtenso(escolhido.duracaoMin)}</span>
            ).
          </p>
        ) : null}
      </fieldset>

      <Campo
        id="agendamento-observacao"
        rotulo="Observação"
        opcional
        ajuda="Recado pra quem for atender — corte, preferência, quem indicou."
      >
        <Textarea
          value={observacao}
          onChange={(e) => aoMudarObservacao(sanitizarTextoLivre(e.target.value))}
          placeholder="Ex.: corta baixo dos lados"
          maxLength={500}
        />
      </Campo>

      {erro ? <Alerta>{erro}</Alerta> : null}
    </form>
  );
}

"use client";

import type { DadosAgendamento } from "@/app/(sistema)/agenda/acoes";
import { Alerta } from "@/components/ui/alerta";
import { Campo } from "@/components/ui/campo";
import { Input, InputDeTempo } from "@/components/ui/input";
import {
  Select,
  SelectConteudo,
  SelectGatilho,
  SelectItem,
  SelectValor,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  CLASSES_SERVICO,
  descricaoDoPasso,
  type PassoDeHorario,
  type Servico,
} from "@/lib/agenda/tipos";
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
  equipeFalhou,
  servicoId,
  aoMudarServicoId,
  data,
  aoMudarData,
  horario,
  aoMudarHorario,
  observacao,
  aoMudarObservacao,
  servicos,
  passoMin,
  erro,
  aoSalvar,
}: {
  clienteNome: string;
  aoMudarClienteNome: (v: string) => void;
  barbeiroId: string;
  aoMudarBarbeiroId: (v: string) => void;
  barbeiros: Barbeiro[];
  /** A leitura da equipe falhou — diferente de "não tem equipe". */
  equipeFalhou?: boolean;
  servicoId: string;
  aoMudarServicoId: (v: string) => void;
  data: string;
  aoMudarData: (v: string) => void;
  horario: string;
  aoMudarHorario: (v: string) => void;
  observacao: string;
  aoMudarObservacao: (v: string) => void;
  servicos: Servico[];
  /** A grade da barbearia: de quanto em quanto tempo um horário começa. */
  passoMin: PassoDeHorario;
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
          /* Duas frases, porque são dois problemas com conserto diferente:
             não ter equipe se resolve cadastrando; não conseguir LER a
             equipe se resolve recarregando. Enquanto era uma frase só, quem
             tinha barbeiro cadastrado era mandado para a tela Barbearia —
             onde eles estavam lá, os dois, olhando de volta. */
          <p className="rounded-lg border border-border bg-secondary/40 px-3 py-3 text-sm text-muted-foreground">
            {equipeFalhou
              ? "Não consegui carregar a equipe. Recarregue a página e tente de novo."
              : "Cadastre um barbeiro em Barbearia antes de marcar horário."}
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
                    {/* Esta linha tambem e o que aparece DENTRO do campo
                        depois de escolhido. Quem encolhe e o nome; o preco
                        e a duracao ficam inteiros, porque sao a informacao
                        que faz escolher. */}
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-2.5 shrink-0 rounded-full",
                          c.pontoBg,
                        )}
                      />
                      <span className="min-w-0 truncate">{s.nome}</span>
                      <span className="shrink-0 whitespace-nowrap text-muted-foreground">
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <InputDeTempo
            id="agendamento-data"
            type="date"
            value={data}
            onChange={(e) => aoMudarData(e.target.value)}
            aria-label="Data"
            required
          />
          <InputDeTempo
            id="agendamento-horario"
            type="time"
            value={horario}
            onChange={(e) => aoMudarHorario(e.target.value)}
            aria-label="Horário de início"
            // O `step` é em SEGUNDOS, e ancora na meia-noite — a mesma grade
            // do banco e da faixa do dia. Com 30 min, as setas do campo
            // andam 09:00 → 09:30, e o relógio do celular oferece só esses.
            step={passoMin * 60}
            required
          />
          <InputDeTempo
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
        <p className="text-sm text-muted-foreground">
          {escolhido ? (
            <>
              Fim calculado pela duração do serviço (
              <span data-numero>
                {duracaoPorExtenso(escolhido.duracaoMin)}
              </span>
              ).{" "}
            </>
          ) : null}
          Esta agenda marca {descricaoDoPasso(passoMin)}.
        </p>
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

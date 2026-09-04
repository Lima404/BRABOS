"use client";

import { useMemo, useRef, useEffect, useState } from "react";
import { GripVertical } from "lucide-react";

import {
  CLASSES_SERVICO,
  type Agendamento,
  type ConfiguracaoAgenda,
  type Servico,
} from "@/lib/agenda/tipos";
import { cn } from "@/lib/utils";

/** Altura de uma hora na linha do tempo — define a escala dos blocos. */
const PX_POR_HORA = 56;

/**
 * Encaixe do horário, em minutos.
 *
 * O mesmo para o toque na faixa e para o arraste: se o arraste fosse mais
 * fino, o bloco pararia em 16:07 e o clique em 16:00, e o dedo passaria a
 * dar um resultado diferente do outro dedo.
 */
const PASSO_MIN = 15;

function minutosDe(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
}

function hhmmDe(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** "Qui, 3 Set" — cabeçalho curto da coluna da direita. */
function cabecalhoDia(data: string): string {
  const d = new Date(`${data}T12:00:00`);
  const semana = d
    .toLocaleDateString("pt-BR", { weekday: "short" })
    .replace(".", "");
  const mes = d
    .toLocaleDateString("pt-BR", { month: "short" })
    .replace(".", "");
  const semanaCap = semana.charAt(0).toUpperCase() + semana.slice(1);
  const mesCap = mes.charAt(0).toUpperCase() + mes.slice(1);
  return `${semanaCap}, ${d.getDate()} ${mesCap}`;
}

/**
 * Coluna da direita do modal de novo agendamento.
 *
 * Mostra o dia escolhido em escala horária: horários já marcados e o bloco
 * âmbar do horário que está sendo criado.
 *
 * Três jeitos de escolher a hora, e os três encaixam de 15 em 15:
 * tocar na faixa, arrastar o bloco, ou setas com o bloco em foco. O arraste
 * é o que responde à pergunta "cabe antes do próximo?" sem contar horário na
 * cabeça — o bloco esbarra visualmente nos vizinhos enquanto sobe e desce.
 */
export function LinhaDoTempoDia({
  data,
  horario,
  duracaoMin,
  agendamentos,
  configuracao,
  servico,
  aoEscolherHorario,
}: {
  data: string;
  /** HH:MM do início selecionado. Vazio = sem bloco novo. */
  horario: string;
  duracaoMin: number;
  agendamentos: Agendamento[];
  configuracao: ConfiguracaoAgenda;
  servico?: Servico;
  aoEscolherHorario: (horario: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [arrastando, setArrastando] = useState(false);
  // Ref além do estado: o `pointermove` dispara mais rápido que o React
  // re-renderiza, e ler o estado ali pegaria o valor do quadro anterior.
  const arrastandoRef = useRef(false);
  const partidaRef = useRef<{ y: number; minuto: number } | null>(null);

  const abreMin = minutosDe(configuracao.abre);
  const fechaMin = minutosDe(configuracao.fecha);
  const totalMin = Math.max(fechaMin - abreMin, 60);
  const altura = (totalMin / 60) * PX_POR_HORA;

  const horas = useMemo(() => {
    const lista: number[] = [];
    for (let m = abreMin; m < fechaMin; m += 60) lista.push(m);
    return lista;
  }, [abreMin, fechaMin]);

  const doDia = useMemo(
    () =>
      agendamentos.filter(
        (a) => a.data === data && a.estado !== "cancelado",
      ),
    [agendamentos, data],
  );

  const selecao = useMemo(() => {
    if (!horario || !/^\d{2}:\d{2}$/.test(horario)) return null;
    const inicio = minutosDe(horario);
    const fim = inicio + Math.max(duracaoMin, 15);
    return { inicio, fim };
  }, [horario, duracaoMin]);

  // Centraliza o bloco selecionado (ou a abertura) ao mudar data/horário.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // Durante o arraste, não: o horário muda a cada pixel, e recentralizar a
    // cada mudança faria a faixa fugir debaixo do dedo que está arrastando.
    if (arrastandoRef.current) return;
    const alvo = selecao ? selecao.inicio : abreMin;
    const top = ((alvo - abreMin) / 60) * PX_POR_HORA - el.clientHeight / 3;
    el.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }, [data, selecao, abreMin]);

  /** Último início que ainda cabe antes de fechar. */
  const ultimoInicio = Math.max(fechaMin - Math.max(duracaoMin, 15), abreMin);

  /**
   * Encaixa, limita ao expediente e avisa o formulário.
   *
   * O `if` de igualdade não é economia à toa: durante o arraste isto roda a
   * cada pixel, e sem ele cada pixel viraria um render do modal inteiro —
   * inclusive da checagem de conflito.
   */
  function definirInicio(minutosBrutos: number) {
    const encaixado = Math.round(minutosBrutos / PASSO_MIN) * PASSO_MIN;
    const limitado = Math.min(Math.max(encaixado, abreMin), ultimoInicio);
    const novo = hhmmDe(limitado);
    if (novo !== horario) aoEscolherHorario(novo);
  }

  function cliqueNaFaixa(evento: React.MouseEvent<HTMLDivElement>) {
    const ret = evento.currentTarget.getBoundingClientRect();
    definirInicio(abreMin + ((evento.clientY - ret.top) / PX_POR_HORA) * 60);
  }

  // ---- arraste do bloco ----
  // Pointer Events, e não mouse + touch separados: um caminho só para dedo,
  // caneta e mouse. `setPointerCapture` mantém o arraste vivo quando o
  // ponteiro sai do bloco, que é o normal ao puxar rápido.

  function aoPressionar(evento: React.PointerEvent<HTMLDivElement>) {
    if (!selecao) return;
    if (evento.pointerType === "mouse" && evento.button !== 0) return;

    // Sem isto o toque no bloco também contaria como toque na faixa.
    evento.stopPropagation();
    evento.currentTarget.setPointerCapture(evento.pointerId);

    arrastandoRef.current = true;
    partidaRef.current = { y: evento.clientY, minuto: selecao.inicio };
    setArrastando(true);
  }

  function aoMover(evento: React.PointerEvent<HTMLDivElement>) {
    const partida = partidaRef.current;
    if (!arrastandoRef.current || !partida) return;

    const deltaMin = ((evento.clientY - partida.y) / PX_POR_HORA) * 60;
    definirInicio(partida.minuto + deltaMin);
  }

  function aoSoltar(evento: React.PointerEvent<HTMLDivElement>) {
    if (!arrastandoRef.current) return;
    arrastandoRef.current = false;
    partidaRef.current = null;
    setArrastando(false);
    evento.currentTarget.releasePointerCapture?.(evento.pointerId);
  }

  /**
   * Seta move o bloco; Shift move de hora em hora.
   *
   * Arrastar não pode ser o único jeito: quem usa teclado ficaria sem
   * escolher horário nenhum. Para cima = mais cedo, seguindo o que o olho vê
   * na faixa — e não a convenção de slider, em que subir aumenta o valor.
   */
  function aoTeclar(evento: React.KeyboardEvent<HTMLDivElement>) {
    if (!selecao) return;
    const passo = evento.shiftKey ? 60 : PASSO_MIN;

    if (evento.key === "ArrowUp") {
      evento.preventDefault();
      definirInicio(selecao.inicio - passo);
    } else if (evento.key === "ArrowDown") {
      evento.preventDefault();
      definirInicio(selecao.inicio + passo);
    } else if (evento.key === "Home") {
      evento.preventDefault();
      definirInicio(abreMin);
    } else if (evento.key === "End") {
      evento.preventDefault();
      definirInicio(ultimoInicio);
    }
  }

  return (
    <aside
      className="flex h-full min-h-72 flex-col border-border bg-card/40 lg:min-h-0 lg:border-l"
      aria-label={`Horários de ${cabecalhoDia(data)}`}
    >
      <header className="shrink-0 border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">{cabecalhoDia(data)}</p>
        <p className="text-xs text-muted-foreground">
          Toque na faixa ou arraste o bloco
        </p>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <div
          role="presentation"
          className="relative cursor-pointer select-none"
          style={{ height: altura }}
          onClick={cliqueNaFaixa}
        >
          {/* Grade horária */}
          {horas.map((m) => {
            const top = ((m - abreMin) / 60) * PX_POR_HORA;
            return (
              <div
                key={m}
                className="pointer-events-none absolute right-0 left-0"
                style={{ top }}
              >
                <div className="flex items-start gap-2">
                  <span
                    data-numero
                    className="-mt-2 w-10 shrink-0 text-right text-xs text-muted-foreground"
                  >
                    {hhmmDe(m)}
                  </span>
                  <div className="relative min-h-[56px] flex-1 border-t border-border">
                    {/* Meia hora pontilhada */}
                    <div
                      className="absolute right-0 left-0 border-t border-dashed border-border/70"
                      style={{ top: PX_POR_HORA / 2 }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {/* Agendamentos já existentes */}
          {doDia.map((a) => {
            const inicio = minutosDe(a.horario);
            const fim = inicio + a.servico.duracaoMin;
            const top = ((inicio - abreMin) / 60) * PX_POR_HORA;
            const h = Math.max(
              ((fim - inicio) / 60) * PX_POR_HORA,
              22,
            );
            const c = CLASSES_SERVICO[a.servico.cor];

            return (
              <div
                key={a.id}
                className={cn(
                  "pointer-events-none absolute right-1 left-12 overflow-hidden rounded-md border border-l-[3px] px-2 py-1",
                  c.fundo,
                  c.borda,
                  c.texto,
                )}
                style={{ top, height: h }}
                title={`${a.horario} · ${a.clienteNome}`}
              >
                <p className="truncate text-xs font-semibold">
                  <span data-numero>{a.horario}</span>
                  {" · "}
                  {a.clienteNome}
                </p>
                <p className="truncate text-[11px] opacity-80">
                  {a.servico.nome}
                </p>
              </div>
            );
          })}

          {/* Bloco do novo agendamento */}
          {selecao ? (
            <div
              role="slider"
              tabIndex={0}
              aria-label="Horário do atendimento"
              aria-orientation="vertical"
              aria-valuemin={abreMin}
              aria-valuemax={ultimoInicio}
              aria-valuenow={selecao.inicio}
              // O leitor de tela anuncia a hora, não o minuto desde a meia-
              // noite: "980" não é horário nenhum.
              aria-valuetext={`${hhmmDe(selecao.inicio)} às ${hhmmDe(selecao.fim)}`}
              onPointerDown={aoPressionar}
              onPointerMove={aoMover}
              onPointerUp={aoSoltar}
              onPointerCancel={aoSoltar}
              onKeyDown={aoTeclar}
              // Clique no bloco não é clique na faixa: sem isto, soltar o
              // arraste jogaria o bloco de volta pra posição do ponteiro.
              onClick={(evento) => evento.stopPropagation()}
              className={cn(
                "absolute right-1 left-12 flex touch-none items-start gap-1 overflow-hidden rounded-md border border-primary bg-primary/20 px-2 py-1 text-foreground",
                "cursor-grab active:cursor-grabbing",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                arrastando
                  ? "shadow-lg ring-2 ring-primary"
                  : "shadow-sm ring-1 ring-primary/40",
              )}
              style={{
                top: ((selecao.inicio - abreMin) / 60) * PX_POR_HORA,
                height: Math.max(
                  ((selecao.fim - selecao.inicio) / 60) * PX_POR_HORA,
                  28,
                ),
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  <span data-numero>
                    {hhmmDe(selecao.inicio)} – {hhmmDe(selecao.fim)}
                  </span>
                </p>
                {servico ? (
                  <p className="truncate text-[11px] text-muted-foreground">
                    {servico.nome}
                  </p>
                ) : null}
              </div>

              {/* Uma alça de mover, e não duas bolinhas em cantos opostos:
                  canto oposto é o desenho de redimensionar, e aqui a duração
                  vem do serviço — ela não se estica na mão. */}
              <GripVertical
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
            </div>
          ) : null}
        </div>
      </div>
    </aside>
  );
}

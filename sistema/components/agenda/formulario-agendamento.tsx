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
  horariosDaGrade,
  noPassoDaAgenda,
  passoDaAgenda,
} from "@/lib/agenda/horarios";
import {
  CLASSES_SERVICO,
  descricaoDoPasso,
  type ConfiguracaoAgenda,
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
  configuracao,
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
  /** Expediente e grade: é o que decide quais horários existem no dia. */
  configuracao: ConfiguracaoAgenda;
  erro: string | null;
  aoSalvar: (dados: DadosAgendamento) => void;
}) {
  const escolhido = servicos.find((s) => s.id === servicoId);
  const fim =
    horario && escolhido
      ? hhmmDe(minutosDe(horario) + escolhido.duracaoMin)
      : "";

  const passoMin = passoDaAgenda(configuracao);

  /**
   * Os horários que este dia oferece — não um campo de hora livre.
   *
   * O `step` do `<input type="time">` não segura o seletor nativo: o
   * calendário do navegador continuava listando minuto a minuto (03, 04,
   * 05…), e a pessoa escolhia 13:05 num sistema que marca de 15 em 15.
   * Depois levava a recusa. Oferecer só o que vale é mais curto de usar do
   * que digitar e ser corrigido.
   *
   * A duração corta o fim da lista: com 1h de serviço numa loja que fecha
   * às 19h, o último começo é 18:00.
   */
  const horarios = horariosDaGrade(configuracao, escolhido?.duracaoMin ?? 30);

  /**
   * Um horário já marcado pode estar FORA da grade de hoje — a barbearia
   * trocou de 15 para 30 e o cliente das 09:45 continua lá. Ele entra na
   * lista mesmo assim, marcado: sumir com o valor do campo ao abrir a
   * edição trocaria o horário de alguém sem ninguém pedir.
   */
  const forasteiro = Boolean(horario) && !horarios.includes(horario);
  const opcoes = forasteiro ? [horario, ...horarios] : horarios;

  // Duas razões diferentes para um horário estar fora da lista, e a etiqueta
  // não pode chutar: ou ele não bate com a grade (a barbearia trocou de 15
  // para 30 depois de marcar), ou ele bate mas o serviço escolhido agora não
  // termina antes de fechar. Dizer "fora da grade" no segundo caso mandaria
  // a pessoa mexer na configuração à toa.
  const etiquetaDoForasteiro = !horario
    ? ""
    : noPassoDaAgenda(horario, configuracao)
      ? "· não cabe no dia"
      : "· fora da grade";

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
          <Select value={horario || undefined} onValueChange={aoMudarHorario}>
            <SelectGatilho
              id="agendamento-horario"
              aria-label="Horário de início"
            >
              <SelectValor placeholder="Horário" />
            </SelectGatilho>
            <SelectConteudo>
              {opcoes.map((h) => (
                <SelectItem key={h} value={h}>
                  <span className="flex min-w-0 items-center gap-2">
                    <span data-numero>{h}</span>
                    {forasteiro && h === horario ? (
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {etiquetaDoForasteiro}
                      </span>
                    ) : null}
                  </span>
                </SelectItem>
              ))}
            </SelectConteudo>
          </Select>

          {/* Não é campo: é resultado. Antes era um `input` desabilitado, o
              que promete edição e nega no mesmo gesto. */}
          <p
            id="agendamento-fim"
            className="flex h-12 items-center rounded-lg border border-dashed border-border bg-secondary/30 px-3 text-base text-muted-foreground"
          >
            <span className="shrink-0 text-sm">até&nbsp;</span>
            <span data-numero className="truncate">
              {fim || "--:--"}
            </span>
          </p>
        </div>
        {horarios.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nenhum horário do dia comporta esse serviço inteiro
            {escolhido ? ` (${duracaoPorExtenso(escolhido.duracaoMin)})` : ""}.
            Escolha um serviço mais curto, ou estenda o expediente.
          </p>
        ) : (
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
        )}
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

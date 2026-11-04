"use client";

import { useId, useState } from "react";
import {
  AlertTriangle,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { EstadoVazio } from "@/components/ui/estado-vazio";
import { Switch } from "@/components/ui/switch";
import { CLASSES_SERVICO, ESTADOS, type Agendamento } from "@/lib/agenda/tipos";
import { diaComSemana, diaCurto, ehHoje, moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Painel do dia. Por padrao mostra hoje; clicar num dia do calendario troca.
 *
 * E a leitura que o barbeiro faz de relance entre um cliente e outro, entao
 * vem em ordem de horario, com o horario em coluna fixa (tabular-nums).
 *
 * Tocar num cartao abre as duas acoes do atendimento: editar e concluir. Elas
 * ficam escondidas ate o toque de proposito — a leitura de relance e o que
 * este painel faz o dia inteiro, e dois botoes por linha viram parede de
 * botao com quatro clientes na lista.
 */
export function PainelDia({
  dia,
  agendamentos,
  aoNovoAgendamento,
  aoEditar,
  aoConcluir,
  aoAlternarConclusao,
  alternandoId,
}: {
  /** AAAA-MM-DD */
  dia: string;
  agendamentos: Agendamento[];
  aoNovoAgendamento: () => void;
  aoEditar: (agendamento: Agendamento) => void;
  /** Abre a comanda do atendimento; quem conclui de fato e o modal. */
  aoConcluir: (agendamento: Agendamento) => void;
  /** A chave do cabeçalho: conclui e desconclui num toque só. */
  aoAlternarConclusao: (agendamento: Agendamento, concluir: boolean) => void;
  /** Qual cartão espera resposta — só a chave dele trava. */
  alternandoId: string | null;
}) {
  const hoje = ehHoje(dia);
  const total = agendamentos.reduce((s, a) => s + a.precoCentavos, 0);

  // Um aberto por vez: dois cartoes abertos empurram o resto da lista pra
  // fora da tela justo quando a pessoa esta procurando o proximo horario.
  const [abertoId, setAbertoId] = useState<string | null>(null);

  return (
    <section
      aria-label={`Agendamentos de ${diaComSemana(dia)}`}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <header>
        <h2 className="font-semibold">
          {hoje ? `Hoje, ${diaCurto(dia)}` : diaComSemana(dia)}
        </h2>
        <p className="text-sm text-muted-foreground">
          <span data-numero>{agendamentos.length}</span>{" "}
          {agendamentos.length === 1 ? "agendamento" : "agendamentos"}
          {total > 0 ? (
            <>
              {" · "}
              <span data-numero>{moeda(total)}</span>
            </>
          ) : null}
        </p>
      </header>

      {agendamentos.length === 0 ? (
        <EstadoVazio
          icone={Clock}
          titulo="Nenhum agendamento"
          descricao="Quando alguém marcar, aparece aqui em ordem de horário."
          acao={
            <Button
              variant="secondary"
              className="w-full"
              onClick={aoNovoAgendamento}
            >
              <CalendarPlus />
              Novo agendamento
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {agendamentos.map((a) => (
            <ItemDoDia
              key={a.id}
              agendamento={a}
              aberto={abertoId === a.id}
              aoAlternar={() =>
                setAbertoId((atual) => (atual === a.id ? null : a.id))
              }
              aoEditar={() => aoEditar(a)}
              aoConcluir={() => aoConcluir(a)}
              aoAlternarConclusao={(c) => aoAlternarConclusao(a, c)}
              alternando={alternandoId === a.id}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ItemDoDia({
  agendamento: a,
  aberto,
  aoAlternar,
  aoEditar,
  aoConcluir,
  aoAlternarConclusao,
  alternando,
}: {
  agendamento: Agendamento;
  aberto: boolean;
  aoAlternar: () => void;
  aoEditar: () => void;
  aoConcluir: () => void;
  aoAlternarConclusao: (concluir: boolean) => void;
  alternando: boolean;
}) {
  const cor = CLASSES_SERVICO[a.servico.cor];
  const estado = ESTADOS[a.estado];
  const concluido = a.estado === "concluido";
  const cancelado = a.estado === "cancelado";
  const encerrado = concluido || cancelado;
  const idAcoes = useId();

  return (
    <li
      className={cn(
        // `relative` por causa da chave: ela é um controle DENTRO de um
        // cartão que inteiro já é um botão, e botão não pode conter botão —
        // nem no HTML, nem no gesto (o toque na chave abriria as ações
        // junto). Ela fica POR CIMA, irmã do botão, e não descendente dele.
        "relative flex flex-col rounded-lg border border-border border-l-[3px]",
        cor.borda,
        encerrado && "opacity-70",
      )}
    >
      {/* O cartao inteiro e o alvo: no celular, mirar num icone pequeno com
          a mao ocupada nao funciona. */}
      <button
        type="button"
        onClick={aoAlternar}
        aria-expanded={aberto}
        aria-controls={idAcoes}
        className={cn(
          "flex min-h-11 flex-col gap-2 rounded-lg p-3 text-left transition-colors",
          "hover:bg-secondary/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        )}
      >
        <div className="flex items-baseline gap-2">
          <time
            dateTime={`${a.data}T${a.horario}`}
            className="shrink-0 text-sm font-semibold text-muted-foreground"
          >
            {a.horario}
          </time>
          <span className="min-w-0 flex-1 truncate font-semibold">
            {a.clienteNome}
          </span>
          {/* O lugar da chave, vazio aqui dentro. Existe para que o nome do
              cliente corte ANTES de chegar nela — sem o vão, nome comprido
              passaria por baixo de um controle. */}
          {cancelado ? null : (
            <span aria-hidden="true" className="w-11 shrink-0" />
          )}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              aberto && "rotate-180",
            )}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              cor.fundo,
              cor.texto,
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", cor.pontoBg)}
            />
            {a.servico.nome}
          </span>

          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
              estado.classe,
            )}
          >
            {estado.alerta ? (
              <AlertTriangle className="size-3" aria-hidden="true" />
            ) : null}
            {estado.rotulo}
          </span>

          <span data-numero className="ml-auto text-sm text-muted-foreground">
            {moeda(a.precoCentavos)}
          </span>
        </div>

        {a.observacao ? (
          <p className="text-sm text-muted-foreground">{a.observacao}</p>
        ) : null}
      </button>

      {/* A CHAVE. Fica sobre o vão reservado lá em cima: `right-9` são os
          12px de recuo do cartão + 16px da seta + 8px do intervalo entre
          elas. `top-2.5` centra os 24px da chave na linha de 20px.

          Ela aplica na hora, sem confirmar, porque é para isso que serve:
          o barbeiro acabou de cortar, tem a mão ocupada, e o gesto tem que
          caber num toque. O caminho cuidadoso continua no botão Concluir,
          que abre a comanda para conferir o consumo antes de fechar.

          Cancelado não tem chave: concluir um horário que não aconteceu não
          quer dizer nada, e chave que não faz sentido ainda assim convida
          ao toque. */}
      {cancelado ? null : (
        <div className="absolute top-2.5 right-9">
          <Switch
            checked={concluido}
            disabled={alternando}
            onCheckedChange={aoAlternarConclusao}
            aria-label={`Concluir o atendimento de ${a.clienteNome} às ${a.horario}`}
          />
        </div>
      )}

      {/* `hidden` em vez de desmontar: o `aria-controls` acima aponta pra um
          elemento que precisa existir na arvore mesmo fechado. */}
      <div
        id={idAcoes}
        hidden={!aberto}
        className="flex flex-col gap-2 border-t border-border p-3 sm:flex-row"
      >
        <Button
          type="button"
          variant="outline"
          className="sm:flex-1"
          onClick={aoEditar}
        >
          <Pencil />
          Editar
        </Button>

        {/* Concluir some quando ja acabou: botao que nao faz nada e pior que
            botao ausente — a pessoa toca e fica esperando. */}
        {encerrado ? (
          <p className="flex min-h-11 items-center text-sm text-muted-foreground sm:flex-1">
            {concluido
              ? "Concluído. A chave no topo reabre."
              : "Agendamento cancelado."}
          </p>
        ) : (
          <Button
            type="button"
            variant="secondary"
            className="sm:flex-1"
            onClick={aoConcluir}
          >
            <Check />
            Concluir
          </Button>
        )}
      </div>
    </li>
  );
}

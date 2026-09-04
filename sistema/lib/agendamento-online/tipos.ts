import { proximoHorarioLivre } from "@/lib/agenda/horarios";
import type {
  Agendamento,
  ConfiguracaoAgenda,
  Servico,
} from "@/lib/agenda/tipos";
import type { Barbeiro } from "@/lib/barbearia/tipos";

/**
 * Domínio da tela pública de agendamento (`/agendar/<slug>`).
 *
 * O que chega aqui é deliberadamente menos do que a agenda interna vê: a RPC
 * `agenda_publica` (migração 0018) devolve os horários OCUPADOS sem nome de
 * cliente e sem telefone de barbeiro. Quem vai marcar precisa saber que as
 * 10h estão presas; de quem elas são não é da conta dele.
 */

/** Um retângulo ocupado na faixa do dia. Sem dono, de propósito. */
export type HorarioOcupado = {
  barbeiroId: string;
  /** HH:MM */
  horario: string;
  duracaoMin: number;
};

/** Barbeiro como o público o vê: nome e nada mais. */
export type BarbeiroPublico = Pick<Barbeiro, "id" | "nome">;

export type AgendaPublica = {
  barbearia: { id: string; nome: string; slug: string };
  configuracao: ConfiguracaoAgenda;
  servicos: Servico[];
  barbeiros: BarbeiroPublico[];
  ocupados: HorarioOcupado[];
  /**
   * O dia consultado é folga? Só o booleano do dia pedido — devolver a lista
   * de folgas do mês contaria pra fora quando a barbearia está vazia, e quem
   * abre o link não tem o que fazer com isso.
   */
  folga: boolean;
};

/**
 * Transforma um horário ocupado num `Agendamento` de mentira.
 *
 * Existe para reaproveitar a linha do tempo e a checagem de conflito da
 * agenda interna sem duplicar as duas — elas falam `Agendamento`, e o que
 * temos aqui é menos que isso. O nome do "cliente" é a palavra **Ocupado**,
 * que é literalmente tudo o que a tela pública tem direito de mostrar.
 *
 * Nada disso volta pro servidor: some quando a página fecha.
 */
export function ocupadoComoAgendamento(
  o: HorarioOcupado,
  data: string,
  indice: number,
): Agendamento {
  return {
    id: `ocupado-${indice}`,
    clienteNome: "Ocupado",
    barbeiroId: o.barbeiroId,
    servico: {
      id: "ocupado",
      nome: "Horário indisponível",
      cor: "grafite",
      duracaoMin: o.duracaoMin,
    },
    data,
    horario: o.horario,
    estado: "agendado",
    precoCentavos: 0,
    duracaoMin: o.duracaoMin,
  };
}

/**
 * O horário em que o formulário público abre.
 *
 * Calculado no SERVIDOR e descido como prop, não lido no navegador: o valor
 * depende do relógio, e um `useState` que lê a hora faz o HTML do servidor
 * discordar da hidratação. Como prop, os dois lados enxergam o mesmo número.
 *
 * Vale para a primeira combinação que o formulário mostra — primeiro
 * barbeiro, primeiro serviço —, que é a que o cliente vê antes de mexer em
 * nada. Sem vaga, cai na abertura, e a faixa cheia ao lado conta o porquê.
 */
export function horarioInicialPublico(
  agenda: AgendaPublica,
  data: string,
  agora: string | null,
): string {
  const barbeiroId = agenda.barbeiros[0]?.id ?? "";
  const duracaoMin = agenda.servicos[0]?.duracaoMin ?? 30;

  return (
    proximoHorarioLivre({
      data,
      duracaoMin,
      barbeiroId,
      agendamentos: agenda.ocupados
        .filter((o) => o.barbeiroId === barbeiroId)
        .map((o, i) => ocupadoComoAgendamento(o, data, i)),
      configuracao: agenda.configuracao,
      agora,
    }) ?? agenda.configuracao.abre
  );
}

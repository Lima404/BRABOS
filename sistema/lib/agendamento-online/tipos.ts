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

import { proximoHorarioLivre } from "@/lib/agenda/horarios";
import { linkDoWhatsApp } from "@/lib/formato";
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
 * cliente. Quem vai marcar precisa saber que as 10h estão presas; de quem
 * elas são não é da conta dele.
 *
 * O telefone do barbeiro, que a 0018 escondia, passou a vir na 0039 — e
 * com ele a consequência de que quem tem o link vê o celular da equipe
 * inteira. O cabeçalho daquela migração conta a decisão por extenso.
 */

/** Um retângulo ocupado na faixa do dia. Sem dono, de propósito. */
export type HorarioOcupado = {
  barbeiroId: string;
  /** HH:MM */
  horario: string;
  duracaoMin: number;
};

/**
 * Barbeiro como o público o vê.
 *
 * Era nome e nada mais. Desde a migração 0039 traz o telefone, porque é
 * para o WhatsApp DELE que o cliente é mandado depois de marcar — quem
 * corta o cabelo é quem sabe remarcar e quem precisa saber do atraso.
 *
 * `null` quando a linha não tem número utilizável; aí a tela cai no
 * telefone da barbearia, e só depois desiste de oferecer o WhatsApp.
 */
export type BarbeiroPublico = Pick<Barbeiro, "id" | "nome"> & {
  telefone: string | null;
};

/**
 * O convite por onde a pessoa entrou, quando foi por um.
 *
 * `null` quando ela entrou pelo link do apelido — que não expira, não tem
 * limite e não precisa de contador.
 */
export type ConviteDaAgenda = {
  codigo: string;
  /** ISO, ou null quando não expira. */
  expiraEm: string | null;
  usos: number;
  /** null = ilimitado. */
  usosMax: number | null;
};

export type AgendaPublica = {
  barbearia: {
    id: string;
    nome: string;
    slug: string;
    /**
     * Para onde o cliente é mandado depois de marcar (migração 0036).
     *
     * `null` quando a barbearia não cadastrou número — e aí a tela
     * simplesmente não oferece o WhatsApp, em vez de abrir uma conversa
     * com ninguém.
     */
    telefone: string | null;
  };
  convite: ConviteDaAgenda | null;
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

// ============================================================
// O recado do WhatsApp
// ============================================================

/** Para onde o cliente vai depois de marcar, e com que texto. */
export type AvisoNoWhats = {
  /** `https://wa.me/...` com a mensagem já escrita. */
  link: string;
  /**
   * O nome de quem vai receber — para a TELA dizer, não para o recado.
   * Ser jogado numa conversa sem saber de quem é o número assusta.
   */
  para: string;
};

/**
 * Monta a conversa que abre depois do horário entrar.
 *
 * Função pura e fora do componente para poder ser testada: a escolha do
 * destino tem três saídas (barbeiro, barbearia, ninguém) e o texto muda
 * junto com ela — é exatamente o tipo de regra que se quebra em silêncio.
 *
 * **O destino é o BARBEIRO** (migração 0039). Quem corta o cabelo é quem
 * sabe remarcar, quem precisa saber do atraso de dez minutos e quem perde
 * a tarde quando o cliente some; mandar tudo para o número geral obrigava
 * alguém a repassar.
 *
 * A barbearia é a reserva — e não para barbeiro sem telefone, que a 0014
 * proíbe no banco. Ela cobre a tela nova falando com um banco SEM a 0039:
 * ali o telefone chega indefinido e o cliente vai para a barbearia, como
 * ia antes, em vez de ficar sem WhatsApp nenhum durante o deploy.
 *
 * `null` quando não há número nenhum: a tela então manda anotar o
 * horário, em vez de abrir conversa com ninguém.
 */
export function recadoDoAgendamento(entrada: {
  nomeDaBarbearia: string;
  telefoneDaBarbearia: string | null;
  barbeiro: { nome: string; telefone: string | null } | null;
  clienteNome: string;
  clienteTelefone: string;
  /** "Sexta-feira, 23 de outubro" — já por extenso. */
  diaPorExtenso: string;
  /** HH:MM */
  horario: string;
  nomeDoServico: string | null;
}): AvisoNoWhats | null {
  const destino = entrada.barbeiro?.telefone ?? entrada.telefoneDaBarbearia;
  const paraOBarbeiro = Boolean(entrada.barbeiro?.telefone);
  const barbeiro = entrada.barbeiro;

  // Falando COM o barbeiro, o recado cumprimenta ele pelo nome. Falando
  // com a barbearia, continua impessoal — e aí o nome do barbeiro vira
  // informação do agendamento, lá embaixo, porque quem lê precisa saber
  // de quem é aquele horário.
  const linhas = [
    paraOBarbeiro && barbeiro
      ? `Olá, ${barbeiro.nome}! Acabei de marcar um horário com você na ${entrada.nomeDaBarbearia}.`
      : `Olá! Acabei de marcar um horário na ${entrada.nomeDaBarbearia}.`,
    "",
    entrada.clienteNome.trim(),
  ];

  // O telefone do cliente entra junto do nome: quem recebe precisa saber
  // com quem está falando E por onde responder. Sem ele sobra o número de
  // quem mandou a mensagem — o certo quase sempre, mas não quando alguém
  // marca pelo aparelho de outra pessoa.
  //
  // O `if` não é defesa inútil: a tela pode estar aberta desde antes do
  // campo existir, e linha em branco no meio do recado é pior que linha a
  // menos.
  const telefone = entrada.clienteTelefone.trim();
  if (telefone) linhas.push(telefone);

  linhas.push(`${entrada.diaPorExtenso} às ${entrada.horario}`);

  if (entrada.nomeDoServico) {
    linhas.push(
      !paraOBarbeiro && barbeiro
        ? `${entrada.nomeDoServico} com ${barbeiro.nome}`
        : entrada.nomeDoServico,
    );
  }

  const link = linkDoWhatsApp(destino, linhas.join("\n"));
  if (!link) return null;

  return {
    link,
    para: paraOBarbeiro && barbeiro ? barbeiro.nome : entrada.nomeDaBarbearia,
  };
}

import type {
  Agendamento,
  ConfiguracaoAgenda,
  ItemDaComanda,
  Servico,
} from "@/lib/agenda/tipos";

/** Chamadas do navegador. O servidor usa lib/agenda/repositorio direto. */

/**
 * Resposta que deveria ser JSON.
 *
 * O teste de content-type não é zelo excessivo: com a sessão expirada o proxy
 * redireciona pra tela de login, o fetch segue o redirecionamento e volta 200
 * com HTML. Sem esta checagem o `.json()` estoura e o barbeiro lê
 * "Unexpected token '<'" no meio do expediente.
 */
async function comoJson<T>(resposta: Response, oQue: string): Promise<T> {
  if (resposta.status === 401 || resposta.redirected) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar ${oQue}.`);
  }

  if (!resposta.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  return resposta.json() as Promise<T>;
}

export async function buscarAgendaDoMes(mes: string): Promise<Agendamento[]> {
  const resposta = await fetch(`/api/agenda?mes=${mes}`);
  return comoJson<Agendamento[]>(resposta, "a agenda");
}

export type ConfiguracaoCompleta = {
  configuracao: ConfiguracaoAgenda;
  servicos: Servico[];
};

export async function buscarConfiguracao(): Promise<ConfiguracaoCompleta> {
  const resposta = await fetch("/api/agenda/configuracao");
  return comoJson<ConfiguracaoCompleta>(resposta, "a configuração da agenda");
}

/**
 * Os itens consumidos num atendimento — o corpo da comanda.
 *
 * Devolve lista vazia quando o agendamento não teve consumo, que é o caso
 * comum: quem só cortou o cabelo não comeu nada.
 */
export async function buscarComanda(
  agendamentoId: string,
): Promise<ItemDaComanda[]> {
  const resposta = await fetch(
    `/api/agenda/comanda?agendamento=${encodeURIComponent(agendamentoId)}`,
  );
  return comoJson<ItemDaComanda[]>(resposta, "a comanda");
}

import { QueryClient, isServer } from "@tanstack/react-query";

/**
 * Configuracao do React Query.
 *
 * staleTime alto de proposito: a agenda do dia nao muda a cada segundo, e o
 * barbeiro costuma estar no 4G da rua. Refetch agressivo aqui gasta dados e
 * pisca a tela no meio do atendimento.
 */
function criarQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let clienteNoNavegador: QueryClient | undefined;

export function obterQueryClient(): QueryClient {
  // No servidor, um cliente novo por requisicao (nunca compartilhar cache
  // entre usuarios). No navegador, um so pra vida da aba.
  if (isServer) return criarQueryClient();
  clienteNoNavegador ??= criarQueryClient();
  return clienteNoNavegador;
}

/**
 * O cache da CONTA logada — e não o da aba.
 *
 * ============================================================
 * ISTO CONSERTOU UM VAZAMENTO ENTRE CONTAS. NÃO SIMPLIFICAR.
 * ============================================================
 *
 * O cliente acima vive "pra vida da aba", e a aba SOBREVIVE a sair e
 * entrar: o `sair` termina em `redirect()` dentro de uma ação de servidor,
 * que o Next resolve pelo roteador — sem recarregar o documento. O
 * JavaScript continua de pé, o cliente de cache junto, e a conta seguinte
 * encontrava a lista da conta anterior já pronta e "fresca" (staleTime de
 * 60s), então nem refazia a busca.
 *
 * O servidor sempre esteve certo — o RLS nunca entregou linha de outra
 * barbearia. Quem mentia era a tela, mostrando o que tinha guardado.
 *
 * Aqui o cache passa a pertencer à conta: id diferente, cliente novo. Vale
 * para TODAS as telas do sistema, não só para os convites — agenda, estoque
 * e dashboard corriam o mesmo risco.
 *
 * Guardamos só o mais recente de propósito. Voltar para a conta anterior
 * recomeça com cache vazio, que é mais lento e nunca errado.
 */
let cacheDaConta: { id: string | null; cliente: QueryClient } | undefined;

export function obterQueryClientDaConta(id: string | null): QueryClient {
  if (isServer) return criarQueryClient();

  if (!cacheDaConta || cacheDaConta.id !== id) {
    cacheDaConta = { id, cliente: criarQueryClient() };
  }
  return cacheDaConta.cliente;
}

/** Chaves de cache. Centralizadas pra nunca divergir entre telas. */
export const chaves = {
  agenda: {
    todas: ["agenda"] as const,
    /** `mes` no formato AAAA-MM — o calendário carrega um mês por vez. */
    mes: (mes: string) => ["agenda", "mes", mes] as const,
    /** Configuracao + cardapio de servicos: mudam juntos, cacheiam juntos. */
    configuracao: ["agenda", "configuracao"] as const,
    /** Links de convite — abrem a pedido, no modal do link. */
    convites: ["agenda", "convites"] as const,
    /**
     * Itens consumidos num atendimento. Cache proprio por agendamento: a
     * comanda abre uma de cada vez e nao acompanha o mes.
     */
    comanda: (agendamentoId: string) =>
      ["agenda", "comanda", agendamentoId] as const,
  },
  /** Tela publica de agendamento — cache por barbearia e dia. */
  agendarPublico: {
    todas: ["agendar-publico"] as const,
    dia: (slug: string, data: string) =>
      ["agendar-publico", slug, data] as const,
  },
  dashboard: {
    todas: ["dashboard"] as const,
    /** Intervalo + filtros — chave completa do resumo. */
    resumo: (chave: string) => ["dashboard", "resumo", chave] as const,
  },
  estoque: {
    todas: ["estoque"] as const,
    produtos: ["estoque", "produtos"] as const,
  },
  barbearia: {
    todas: ["barbearia"] as const,
    /**
     * A equipe. A MESMA chave na Agenda, no Dashboard e na Barbearia — é
     * o que faz navegar entre as três não pedir a lista três vezes.
     */
    barbeiros: ["barbearia", "barbeiros"] as const,
    /** Celulares que recebem o aviso de agendamento (migração 0035). */
    aparelhos: ["barbearia", "aparelhos"] as const,
  },
  /**
   * A vitrine. Por apelido, e não uma chave só: a dona abre a loja dela,
   * mas a tela é pública e a mesma aba pode ter aberto a loja de outra
   * barbearia antes.
   */
  loja: {
    todas: ["loja"] as const,
    produtos: (slug: string) => ["loja", slug, "produtos"] as const,
    clientes: (slug: string) => ["loja", slug, "clientes"] as const,
  },
};

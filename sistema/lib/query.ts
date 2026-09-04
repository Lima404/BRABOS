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

/** Chaves de cache. Centralizadas pra nunca divergir entre telas. */
export const chaves = {
  agenda: {
    todas: ["agenda"] as const,
    /** `mes` no formato AAAA-MM — o calendário carrega um mês por vez. */
    mes: (mes: string) => ["agenda", "mes", mes] as const,
    /** Configuracao + cardapio de servicos: mudam juntos, cacheiam juntos. */
    configuracao: ["agenda", "configuracao"] as const,
    /**
     * Itens consumidos num atendimento. Cache proprio por agendamento: a
     * comanda abre uma de cada vez e nao acompanha o mes.
     */
    comanda: (agendamentoId: string) =>
      ["agenda", "comanda", agendamentoId] as const,
  },
  dashboard: {
    todas: ["dashboard"] as const,
    /** Intervalo + filtros — chave completa do resumo. */
    resumo: (chave: string) => ["dashboard", "resumo", chave] as const,
    /** @deprecated use `resumo` — mantido pro prefetch do mês atual. */
    mes: (mes: string) => ["dashboard", "mes", mes] as const,
  },
  estoque: {
    todas: ["estoque"] as const,
    produtos: ["estoque", "produtos"] as const,
  },
  barbearia: {
    todas: ["barbearia"] as const,
    barbeiros: ["barbearia", "barbeiros"] as const,
  },
};

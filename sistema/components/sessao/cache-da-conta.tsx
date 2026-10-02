"use client";

import { QueryClientProvider } from "@tanstack/react-query";

import { obterQueryClientDaConta } from "@/lib/query";

/**
 * Prende o cache do React Query à conta logada.
 *
 * ============================================================
 * ISTO CONSERTOU UM VAZAMENTO ENTRE CONTAS. NÃO REMOVER.
 * ============================================================
 *
 * O `Providers` do layout raiz cria um cliente que vive "pra vida da aba", e
 * a aba sobrevive a sair e entrar: o `sair` termina em `redirect()` dentro de
 * uma ação de servidor, que o Next resolve pelo roteador — sem recarregar o
 * documento. Entrando com OUTRA conta no mesmo navegador, as telas abriam
 * com o que a conta anterior tinha deixado guardado, e com `staleTime` de 60s
 * nem refaziam a busca. Foi assim que a conta "SIPA" apareceu mostrando os
 * links de agendamento de outra barbearia.
 *
 * O servidor nunca entregou linha errada — o RLS cuida disso, e está testado.
 * Quem mentia era a tela, mostrando o que tinha em mãos.
 *
 * **Por que um provedor aninhado, e não limpar o cache num efeito:** efeito
 * roda DEPOIS da pintura, e a pintura é exatamente o instante em que os dados
 * da outra conta apareceriam. Trocando o CLIENTE, a árvore abaixo nasce sem
 * nada guardado — não há quadro intermediário para vazar.
 *
 * **Por que aqui e não no layout raiz:** este layout já chama `obterSessao()`
 * para montar a navegação, então o id sai de graça. No raiz custaria uma ida
 * ao Supabase em toda página pública — inclusive na loja e no link de
 * agendamento, que não têm conta nenhuma.
 */
export function CacheDaConta({
  contaId,
  children,
}: {
  /** `null` quando não há sessão — e aí o cache é o do visitante. */
  contaId: string | null;
  children: React.ReactNode;
}) {
  return (
    <QueryClientProvider client={obterQueryClientDaConta(contaId)}>
      {children}
    </QueryClientProvider>
  );
}

"use client";

import { TelaDeErro } from "@/components/erro/tela-de-erro";

/**
 * Erro numa tela do sistema (agenda, estoque, dashboard…).
 *
 * Fica DENTRO do shell: a barra lateral e o cabeçalho continuam de pé, e
 * a pessoa pode ir para outra tela sem recarregar. Erro no próprio layout
 * deste grupo (a sessão, a barra) não passa por aqui — vai para o
 * `app/global-error.tsx`, porque um `error.tsx` não cobre o layout do
 * mesmo nível.
 */
export default function ErroDoSistema({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return <TelaDeErro error={error} retry={retry} />;
}

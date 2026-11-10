import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listarPatchNotes } from "@/app/(sistema)/notificacoes/acoes";
import { PatchNotes } from "@/components/comunicados/patch-notes";
import { dadosOuErro } from "@/lib/consulta";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Patch notes" };

/**
 * Prefetch no servidor: o link do sino traz `#versao-…`, e o navegador só
 * rola até a versão se ela já estiver na página quando ela chega.
 */
export default async function PaginaPatchNotes() {
  const queryClient = obterQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chaves.comunicados.patchNotes,
    queryFn: () => dadosOuErro(listarPatchNotes()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PatchNotes />
    </HydrationBoundary>
  );
}

import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listarBarbeariasDoPainel } from "@/app/(sistema)/admin/acoes";
import { ListaDeBarbearias } from "@/components/admin/lista-barbearias";
import { dadosOuErro } from "@/lib/consulta";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Barbearias · Painel Admin" };

/** Prefetch + HydrationBoundary, como as outras telas do sistema. */
export default async function BarbeariasDoPainel() {
  const queryClient = obterQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chaves.admin.barbearias,
    queryFn: () => dadosOuErro(listarBarbeariasDoPainel()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListaDeBarbearias />
    </HydrationBoundary>
  );
}

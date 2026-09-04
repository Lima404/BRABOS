import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Estoque } from "@/components/estoque/estoque";
import { listarProdutos } from "@/lib/estoque/repositorio";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Estoque" };

export default async function EstoquePage() {
  const queryClient = obterQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chaves.estoque.produtos,
    queryFn: listarProdutos,
  });

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Estoque</h1>
        <p className="text-muted-foreground">
          Mercearia e produtos de salão, lado a lado com o que tem na prateleira
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Estoque />
      </HydrationBoundary>
    </div>
  );
}

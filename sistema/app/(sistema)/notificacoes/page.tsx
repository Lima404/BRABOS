import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listarMeusComunicados } from "@/app/(sistema)/notificacoes/acoes";
import { ListaDeNotificacoes } from "@/components/comunicados/lista-notificacoes";
import { dadosOuErro } from "@/lib/consulta";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Notificações" };

export default async function Notificacoes() {
  const queryClient = obterQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chaves.comunicados.lista,
    queryFn: () => dadosOuErro(listarMeusComunicados()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListaDeNotificacoes />
    </HydrationBoundary>
  );
}

import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listarComunicadosDoAdmin } from "@/app/(sistema)/admin/acoes";
import { NotificacoesDoAdmin } from "@/components/admin/notificacoes-admin";
import { dadosOuErro } from "@/lib/consulta";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Notificações · Painel Admin" };

export default async function NotificacoesDoPainel() {
  const queryClient = obterQueryClient();

  await queryClient.prefetchQuery({
    queryKey: chaves.admin.comunicados,
    queryFn: () => dadosOuErro(listarComunicadosDoAdmin()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <NotificacoesDoAdmin />
    </HydrationBoundary>
  );
}

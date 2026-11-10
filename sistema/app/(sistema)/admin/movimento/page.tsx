import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import {
  listarBarbeariasDoPainel,
  obterMovimentoDoPainel,
} from "@/app/(sistema)/admin/acoes";
import { Movimento } from "@/components/admin/movimento";
import { filtroAdminDaBusca } from "@/lib/admin/filtros";
import { buscaDaPagina, type BuscaDaPagina } from "@/lib/busca-da-pagina";
import { dadosOuErro } from "@/lib/consulta";
import { intervaloDoPeriodo } from "@/lib/dashboard/filtros";
import { hojeNaBarbearia } from "@/lib/formato";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Movimento · Painel Admin" };

/**
 * O prefetch usa o recorte da URL, como o dashboard: um link filtrado chega
 * pronto, sem mostrar o mês corrente e trocar os números um instante depois.
 * Largura toda, sem `max-w`, pelo mesmo motivo do dashboard.
 */
export default async function MovimentoDoPainel({
  searchParams,
}: {
  searchParams: Promise<BuscaDaPagina>;
}) {
  const mes = hojeNaBarbearia().slice(0, 7);
  const filtro = filtroAdminDaBusca(buscaDaPagina(await searchParams), mes);
  const { inicio, fim } = intervaloDoPeriodo(filtro, mes);
  const queryClient = obterQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: chaves.admin.barbearias,
      queryFn: () => dadosOuErro(listarBarbeariasDoPainel()),
    }),
    queryClient.prefetchQuery({
      queryKey: chaves.admin.movimento(inicio, fim),
      queryFn: () => dadosOuErro(obterMovimentoDoPainel(inicio, fim)),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Movimento mes={mes} />
    </HydrationBoundary>
  );
}

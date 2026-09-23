import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Dashboard } from "@/components/dashboard/dashboard";
import {
  chaveDoIntervalo,
  filtroPadrao,
  intervaloDoFiltro,
} from "@/lib/dashboard/filtros";
import { listarBarbeiros } from "@/lib/barbearia/repositorio";
import { obterResumoDashboard } from "@/lib/dashboard/repositorio";
import { chaves, obterQueryClient } from "@/lib/query";
import { hojeNaBarbearia } from "@/lib/formato";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * O dashboard ocupa a largura toda: sem `max-w`, sem `mx-auto`.
 *
 * O mês vem do relógio DA BARBEARIA. Prefetch usa o mesmo intervalo padrão
 * do cliente (mês atual, sem filtros) pra hidratar sem flash.
 */
export default async function DashboardPage() {
  const mes = hojeNaBarbearia().slice(0, 7);
  const intervalo = intervaloDoFiltro(filtroPadrao(mes), mes);
  const queryClient = obterQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: chaves.dashboard.resumo(chaveDoIntervalo(intervalo)),
      queryFn: () => obterResumoDashboard(intervalo),
    }),
    // Mesma equipe, mesmo motivo da agenda: o filtro por barbeiro dependia
    // de uma chamada do navegador, e quando ela falhava o filtro aparecia
    // vazio — indistinguível de uma barbearia de uma cadeira só.
    queryClient.prefetchQuery({
      queryKey: chaves.barbearia.barbeiros,
      queryFn: listarBarbeiros,
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard mes={mes} />
    </HydrationBoundary>
  );
}

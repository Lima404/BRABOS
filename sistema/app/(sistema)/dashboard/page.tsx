import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Dashboard } from "@/components/dashboard/dashboard";
import {
  chaveDoIntervalo,
  filtroDaBusca,
  intervaloDoFiltro,
} from "@/lib/dashboard/filtros";
import { listarBarbeiros } from "@/lib/barbearia/repositorio";
import { obterResumoDashboard } from "@/lib/dashboard/repositorio";
import { chaves, obterQueryClient } from "@/lib/query";
import { hojeNaBarbearia } from "@/lib/formato";
import { buscaDaPagina, type BuscaDaPagina } from "@/lib/busca-da-pagina";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * O dashboard ocupa a largura toda: sem `max-w`, sem `mx-auto`.
 *
 * O mês vem do relógio DA BARBEARIA.
 *
 * O prefetch usa O RECORTE DA URL, e não mais o mês corrente fixo. É o que
 * faz um link filtrado chegar pronto: quem abre `?barbeiros=…&mes=2026-10`
 * recebe a página já com os números de outubro daquele barbeiro, em vez de
 * ver novembro inteiro e os cartões trocarem de valor um instante depois.
 *
 * `filtroDaBusca` peneira tudo (ver o comentário lá), então endereço torto
 * cai no padrão em vez de derrubar a página.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<BuscaDaPagina>;
}) {
  const mes = hojeNaBarbearia().slice(0, 7);
  const filtro = filtroDaBusca(buscaDaPagina(await searchParams), mes);
  const intervalo = intervaloDoFiltro(filtro, mes);
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

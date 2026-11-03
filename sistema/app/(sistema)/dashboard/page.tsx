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

export const metadata: Metadata = { title: "Dashboard" };

type BuscaDaPagina = Record<string, string | string[] | undefined>;

/**
 * O que veio na barra de endereço, como `URLSearchParams`.
 *
 * O Next entrega a busca já desmontada num objeto, e o mesmo nome repetido
 * (`?servicos=a&servicos=b`) chega como lista. Juntar com vírgula em vez de
 * ficar com o primeiro é o certo aqui porque é exatamente esse o formato
 * das listas de id — assim um link escrito à mão dos dois jeitos funciona.
 */
function buscaDaPagina(bruto: BuscaDaPagina): URLSearchParams {
  const busca = new URLSearchParams();

  for (const [nome, valor] of Object.entries(bruto)) {
    if (typeof valor === "string") busca.set(nome, valor);
    else if (Array.isArray(valor) && valor.length > 0) {
      busca.set(nome, valor.join(","));
    }
  }

  return busca;
}

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

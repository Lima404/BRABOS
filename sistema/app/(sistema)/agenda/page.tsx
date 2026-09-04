import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Agenda } from "@/components/agenda/agenda";
import {
  listarAgendamentosDoMes,
  listarServicos,
  obterConfiguracaoAgenda,
} from "@/lib/agenda/repositorio";
import { chaves, obterQueryClient } from "@/lib/query";
import { mesISO } from "@/lib/formato";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  const mes = mesISO(new Date());
  const queryClient = obterQueryClient();

  // Prefetch no servidor: le o repositorio direto, sem passar por HTTP.
  // O cliente reidrata a mesma chave e nao refaz a chamada.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: chaves.agenda.mes(mes),
      queryFn: () => listarAgendamentosDoMes(mes),
    }),
    queryClient.prefetchQuery({
      queryKey: chaves.agenda.configuracao,
      queryFn: async () => ({
        configuracao: await obterConfiguracaoAgenda(),
        servicos: await listarServicos(),
      }),
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">
          Os horários da barbearia, mês a mês
        </p>
      </div>

      <HydrationBoundary state={dehydrate(queryClient)}>
        <Agenda mesInicial={mes} />
      </HydrationBoundary>
    </div>
  );
}

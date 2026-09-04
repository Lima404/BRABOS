import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { Agenda } from "@/components/agenda/agenda";
import {
  listarAgendamentosDoMes,
  listarFolgas,
  listarServicos,
  obterConfiguracaoAgenda,
} from "@/lib/agenda/repositorio";
import { obterBarbearia } from "@/lib/conta";
import { chaves, obterQueryClient } from "@/lib/query";
import { hojeNaBarbearia } from "@/lib/formato";

export const metadata: Metadata = { title: "Agenda" };

export default async function AgendaPage() {
  // Relógio da barbearia: em produção o Node roda em UTC, e na virada do mês
  // esta página abriria já no mês seguinte, vazia.
  const mes = hojeNaBarbearia().slice(0, 7);
  const queryClient = obterQueryClient();
  // O apelido vem daqui e não de uma consulta no cliente: é ele que monta o
  // endereço de agendamento online, e a barra precisa dele já no primeiro
  // desenho pra decidir se mostra o botão.
  const barbearia = await obterBarbearia();

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
        folgas: await listarFolgas(),
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
        <Agenda mesInicial={mes} slug={barbearia?.slug} />
      </HydrationBoundary>
    </div>
  );
}

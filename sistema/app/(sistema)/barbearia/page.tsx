import type { Metadata } from "next";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { listarAparelhosAvisados } from "@/app/(sistema)/barbearia/acoes";
import { FormularioDadosBarbearia } from "@/components/barbearia/formulario-dados";
import { SecaoEquipe } from "@/components/barbearia/secao-equipe";
import { SecaoNotificacoes } from "@/components/barbearia/secao-notificacoes";
import {
  equipeDisponivel,
  listarBarbeiros,
} from "@/lib/barbearia/repositorio";
import { obterBarbearia } from "@/lib/conta";
import { chaves, obterQueryClient } from "@/lib/query";

export const metadata: Metadata = { title: "Barbearia" };

/**
 * Prefetch no servidor e `HydrationBoundary`, como a Agenda, o Estoque e o
 * Dashboard. Esta era a última tela do sistema que descia os dados como
 * `props` cruas e se atualizava com `router.refresh()`.
 *
 * O que isso muda na prática: a equipe aqui é a MESMA chave de cache da
 * equipe na Agenda e no Dashboard. Quem vem da Agenda já chega com a lista
 * pronta, e cadastrar um barbeiro aqui conserta as três telas sem
 * recarregar nenhuma.
 */
export default async function BarbeariaPage() {
  const barbearia = await obterBarbearia();
  const queryClient = obterQueryClient();

  // `disponivel` continua prop, de propósito: é "a migração 0014 rodou?",
  // uma resposta sobre o formato do banco, que não muda enquanto a tela
  // está aberta. Cache com invalidação seria cerimônia sem dono.
  const disponivel = barbearia ? await equipeDisponivel() : false;

  if (barbearia) {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: chaves.barbearia.barbeiros,
        queryFn: listarBarbeiros,
      }),
      queryClient.prefetchQuery({
        queryKey: chaves.barbearia.aparelhos,
        queryFn: () => listarAparelhosAvisados(),
      }),
    ]);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Barbearia</h1>
        <p className="text-muted-foreground">
          Dados da conta e equipe de barbeiros
        </p>
      </div>

      {barbearia ? (
        <FormularioDadosBarbearia barbearia={barbearia} />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6">
          <p className="font-semibold">Dados da barbearia não encontrados</p>
          <p className="mt-1 text-sm text-muted-foreground">
            A conta existe, mas a leitura da barbearia falhou. Causa mais
            comum: falta rodar alguma migração de{" "}
            <code className="font-mono">supabase/migracoes/</code>. Rode{" "}
            <code className="font-mono">npm run supabase:verificar</code> para
            ver qual.
          </p>
        </div>
      )}

      {barbearia ? (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <SecaoEquipe disponivel={disponivel} />

          {/* Depois da equipe: ligar o aviso num celular só faz sentido
              quando já existe agenda para avisar sobre. */}
          <SecaoNotificacoes />
        </HydrationBoundary>
      ) : null}
    </div>
  );
}

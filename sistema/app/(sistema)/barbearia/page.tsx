import type { Metadata } from "next";

import { FormularioDadosBarbearia } from "@/components/barbearia/formulario-dados";
import { SecaoEquipe } from "@/components/barbearia/secao-equipe";
import {
  equipeDisponivel,
  listarBarbeiros,
} from "@/lib/barbearia/repositorio";
import { obterBarbearia } from "@/lib/conta";

export const metadata: Metadata = { title: "Barbearia" };

export default async function BarbeariaPage() {
  const barbearia = await obterBarbearia();

  const [barbeiros, disponivel] = barbearia
    ? await Promise.all([listarBarbeiros(), equipeDisponivel()])
    : [[], false];

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
        <SecaoEquipe barbeiros={barbeiros} disponivel={disponivel} />
      ) : null}
    </div>
  );
}

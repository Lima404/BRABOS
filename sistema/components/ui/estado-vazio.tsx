import * as React from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * "Não tem nada aqui ainda".
 *
 * Regra do projeto: **estado vazio nunca é beco sem saída.** Ou traz a ação
 * que preenche a tela, ou explica em uma frase o que vai fazer aparecer coisa
 * ali. Uma caixa cinza dizendo só "nenhum resultado" faz a pessoa achar que o
 * sistema quebrou.
 *
 * A borda é tracejada de propósito: diz "espaço reservado", não "cartão".
 */
export function EstadoVazio({
  icone: Icone,
  titulo,
  descricao,
  acao,
  className,
}: {
  icone: LucideIcon;
  titulo: string;
  descricao?: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-lg border border-dashed border-border px-4 py-6 text-center",
        className,
      )}
    >
      <Icone className="size-5 text-muted-foreground" aria-hidden="true" />

      <p className="mt-2 text-sm font-medium">{titulo}</p>

      {descricao ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {descricao}
        </p>
      ) : null}

      {acao ? <div className="mt-4 w-full sm:w-auto">{acao}</div> : null}
    </div>
  );
}

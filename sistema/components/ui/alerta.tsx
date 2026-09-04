import * as React from "react";

import { TONS, type Tom } from "@/components/ui/tons";
import { cn } from "@/lib/utils";

/**
 * Recado dentro da página: erro, aviso, informação, confirmação.
 *
 * Para recado que aparece e some depois de uma ação, use `Toast`. A regra:
 * o que a pessoa precisa reler fica na página; o que confirma uma ação que
 * ela acabou de fazer flutua e some.
 *
 * `role="alert"` só no tom `erro` — leitor de tela interrompe o que está
 * lendo quando vê isso, então usar em recado ameno é abuso.
 */
export type TomDoAlerta = Tom;

export function Alerta({
  tom = "erro",
  titulo,
  children,
  acao,
  className,
}: {
  tom?: Tom;
  /** Opcional. Sem título, a mensagem vira a frase única do alerta. */
  titulo?: string;
  children: React.ReactNode;
  /** Botão ou link de saída. Alerta sem saída é beco. */
  acao?: React.ReactNode;
  className?: string;
}) {
  const { icone: Icone, texto, fundo } = TONS[tom];

  return (
    <div
      role={tom === "erro" ? "alert" : undefined}
      className={cn(
        "flex items-start gap-3 rounded-lg p-3 text-sm",
        fundo,
        texto,
        className,
      )}
    >
      <Icone className="mt-0.5 size-4 shrink-0" aria-hidden="true" />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {titulo ? <p className="font-semibold">{titulo}</p> : null}
        <div className={cn(titulo && "text-foreground")}>{children}</div>
        {acao ? <div className="mt-1 flex flex-wrap gap-2">{acao}</div> : null}
      </div>
    </div>
  );
}

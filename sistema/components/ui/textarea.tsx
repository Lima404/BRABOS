"use client";

import * as React from "react";

import { propsDoCampo, useCampo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * Texto de várias linhas — observação do agendamento, recado da barbearia.
 *
 * Mesma borda, mesmo raio e mesmo texto de 16px do `Input`. A altura mínima é
 * de três linhas: uma caixa de uma linha só convida a escrever pouco, e a
 * observação é justamente onde mora o "cliente do Seu Zé, corta baixo dos
 * lados".
 */
export function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  const campo = useCampo();

  return (
    <textarea
      data-slot="textarea"
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        "min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base transition-colors outline-none",
        "field-sizing-content resize-y",
        "placeholder:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50",
        className,
      )}
    />
  );
}

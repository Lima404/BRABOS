"use client";

import * as React from "react";

import { propsDoCampo, useCampo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  // Dentro de um <Campo>, herda id, aria-describedby e aria-invalid sozinho.
  // Fora dele, `propsDoCampo` devolve vazio e nada muda.
  const campo = useCampo();

  return (
    <input
      type={type}
      data-slot="input"
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        // AJUSTADO PARA O BARBOS: 48px de altura (alvo de toque ideal) e
        // texto sempre 16px — o shadcn encolhe pra 14px no desktop (md:text-sm),
        // mas o design-guide proibe texto de campo abaixo de 16px.
        // O fundo vem de --card: --input aqui e cor de BORDA (graf-400), nao de
        // preenchimento; usar bg-input deixaria o campo cinza no tema escuro.
        "h-12 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
    />
  );
}

export { Input };

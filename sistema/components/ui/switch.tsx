"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { propsDoCampo, useCampo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * Liga/desliga que vale na hora.
 *
 * Diferença para a `Checkbox`, e ela importa: a chave **aplica sozinha**
 * ("aceitar agendamento pelo link"), a caixa só marca uma escolha que será
 * salva depois no botão. Chave dentro de formulário com "Salvar" mente sobre
 * quando a coisa acontece — nesse caso use `Checkbox`.
 *
 * Ligada = âmbar; desligada = a mesma borda dos campos. Como cor sozinha não
 * basta, a bolinha muda de lado: a posição é o sinal principal.
 */
export function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  const campo = useCampo();

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        "peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input bg-secondary transition-colors outline-none",
        // Alvo de toque de 44px de altura sem engordar o desenho.
        "before:absolute before:top-1/2 before:left-1/2 before:h-11 before:w-full before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-5 rounded-full bg-card shadow-sm ring-1 ring-border transition-transform",
          "translate-x-0.5 data-[state=checked]:translate-x-[1.375rem]",
          "data-[state=checked]:bg-primary-foreground data-[state=checked]:ring-transparent",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

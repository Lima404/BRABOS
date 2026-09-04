"use client";

import * as React from "react";
import { RadioGroup as RadioPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

/**
 * Escolha única.
 *
 * Quando usar em vez do `Select`: até cinco opções que a pessoa precisa
 * comparar de relance — forma de pagamento, estado do agendamento. Acima
 * disso, ou quando a lista pode crescer, use `Select`.
 *
 * Mesmo desenho e mesmo alvo de 44px da `Checkbox`; a diferença é a forma
 * redonda, que é o sinal de "só um".
 */

export function RadioGrupo({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Root>) {
  return (
    <RadioPrimitive.Root
      data-slot="radio-group"
      className={cn("flex flex-col gap-1", className)}
      {...props}
    />
  );
}

export function RadioItem({
  className,
  ...props
}: React.ComponentProps<typeof RadioPrimitive.Item>) {
  return (
    <RadioPrimitive.Item
      data-slot="radio-item"
      className={cn(
        "peer relative size-5 shrink-0 rounded-full border border-input bg-card outline-none transition-colors",
        // Alvo de toque de 44px sem mexer no desenho.
        "before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary",
        "disabled:pointer-events-none disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    >
      <RadioPrimitive.Indicator className="flex size-full items-center justify-center">
        {/* Bolinha em grafite sobre o âmbar — o mesmo par do "certo" da caixa. */}
        <span className="size-2 rounded-full bg-primary-foreground" />
      </RadioPrimitive.Indicator>
    </RadioPrimitive.Item>
  );
}

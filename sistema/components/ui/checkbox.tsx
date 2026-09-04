"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon, MinusIcon } from "lucide-react";

import { propsDoCampo, useCampo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * Caixa de seleção.
 *
 * A caixa desenhada tem 20px, mas a área que responde ao toque tem 44px — o
 * `before:` estende o alvo para fora sem empurrar o rótulo do lado. Caixa de
 * 20px como alvo real é impossível de acertar com o dedo em pé no balcão.
 *
 * Marcada = âmbar com o "certo" em grafite (8,93:1). Estado nunca só por cor:
 * o ícone dentro é o sinal, a cor é reforço.
 *
 * Para rótulo e explicação use `Opcao` (`components/ui/campo.tsx`).
 */
export function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const campo = useCampo();

  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        "peer relative size-5 shrink-0 rounded border border-input bg-card outline-none transition-colors",
        // Alvo de toque de 44px sem mexer no desenho.
        "before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground",
        "data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground",
        "disabled:pointer-events-none disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        {props.checked === "indeterminate" ? (
          <MinusIcon className="size-3.5" strokeWidth={3} />
        ) : (
          <CheckIcon className="size-3.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

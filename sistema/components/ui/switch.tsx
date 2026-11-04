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
 * Ligada = âmbar em degradê; desligada = a mesma borda dos campos. Como cor
 * sozinha não basta, a bolinha muda de lado: a posição é o sinal principal.
 */

/**
 * `pequeno` é para chave que mora DENTRO de outra coisa — no cabeçalho de um
 * cartão, ao lado de um ícone de 16px. No tamanho normal ela vira o elemento
 * mais pesado da linha e rouba a leitura do que o cartão tem a dizer.
 *
 * O desenho encolhe; o ALVO DE TOQUE não. Os 44px continuam garantidos pelo
 * `before:`, que é uma área invisível maior que o desenho — polegar não
 * acerta 16 pixels, e encolher o alvo junto transformaria um ajuste visual
 * num defeito de uso.
 */
export type TamanhoSwitch = "normal" | "pequeno";

export function Switch({
  className,
  tamanho = "normal",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  tamanho?: TamanhoSwitch;
}) {
  const campo = useCampo();
  const pequeno = tamanho === "pequeno";

  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      data-tamanho={tamanho}
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        "peer relative inline-flex shrink-0 items-center rounded-full border border-input bg-secondary transition-colors outline-none",
        pequeno ? "h-4 w-7" : "h-6 w-11",
        // Alvo de toque de 44px nos DOIS eixos, sem engordar o desenho.
        // `min-w` e não `w` porque no tamanho normal a chave já passa de 44px
        // de largura e esticar além disso cobriria o que está ao lado.
        "before:absolute before:top-1/2 before:left-1/2 before:h-11 before:w-full before:min-w-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        // O degradê começa no âmbar da marca (`ambar-500`, o mesmo dos
        // botões) e aprofunda — assim a chave ligada tem volume sem virar
        // uma cor que não existe em nenhum outro lugar do sistema.
        "data-[state=checked]:border-ambar-700 data-[state=checked]:bg-linear-to-br data-[state=checked]:from-ambar-500 data-[state=checked]:to-ambar-700",
        "disabled:pointer-events-none disabled:opacity-60",
        className,
      )}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block rounded-full bg-card shadow-sm ring-1 ring-border transition-transform",
          "translate-x-0.5",
          pequeno
            ? "size-3 data-[state=checked]:translate-x-[0.875rem]"
            : "size-5 data-[state=checked]:translate-x-[1.375rem]",
          "data-[state=checked]:bg-primary-foreground data-[state=checked]:ring-transparent",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

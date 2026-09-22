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

/**
 * Campo de data ou de hora.
 *
 * Existe por um motivo só: **quem manda na largura é este invólucro, não o
 * controle nativo.**
 *
 * O `input[type=date]` do Safari se mede pelo próprio texto — e o iOS escreve
 * a data por extenso ("21 de set. de 2026"). Já tentamos convencê-lo pelo
 * CSS (ver `globals.css`: `appearance: none`, `min-width: 0` e a largura do
 * `::-webkit-date-and-time-value`); enquanto ele não obedecer, o que ele
 * insistir em desenhar a mais é cortado AQUI, no fim do próprio campo — onde
 * não há texto, porque o valor fica alinhado à esquerda.
 *
 * Antes desse corte, o excesso empurrava o formulário inteiro e o modal
 * ganhava rolagem lateral: os rótulos apareciam cortados pela esquerda
 * ("viço", "ervação") no iPhone 14 e no 14 Pro Max.
 *
 * `overflow-x: clip` e não `hidden`: `hidden` criaria caixa de rolagem e o
 * campo passaria a deslizar sob o dedo. A margem de 4px preserva o anel de
 * foco, que é desenhado para fora da borda.
 */
function InputDeTempo({ className, ...props }: React.ComponentProps<"input">) {
  return (
    <div className="w-full min-w-0 overflow-x-clip rounded-lg [overflow-clip-margin:4px]">
      <Input {...props} className={className} />
    </div>
  );
}

export { Input, InputDeTempo };

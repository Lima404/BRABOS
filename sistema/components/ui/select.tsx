"use client";

import * as React from "react";
import { Select as SelectPrimitive } from "radix-ui";
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { propsDoCampo, useCampo } from "@/components/ui/campo";
import { cn } from "@/lib/utils";

/**
 * Lista de escolha única.
 *
 * O gatilho é gêmeo do `Input` de propósito — 48px de altura, texto de 16px,
 * mesma borda: num formulário, campo que escreve e campo que escolhe têm que
 * parecer a mesma coisa, senão a coluna fica serrilhada.
 *
 * Cada item da lista também tem 44px. Lista de escolha é justamente onde o
 * dedo erra mais, porque as opções ficam grudadas.
 *
 * ```tsx
 * <Campo rotulo="Serviço">
 *   <Select value={v} onValueChange={setV}>
 *     <SelectGatilho><SelectValor placeholder="Escolha" /></SelectGatilho>
 *     <SelectConteudo>
 *       <SelectItem value="cabelo">Cabelo</SelectItem>
 *     </SelectConteudo>
 *   </Select>
 * </Campo>
 * ```
 */

export const Select = SelectPrimitive.Root;
export const SelectGrupo = SelectPrimitive.Group;

export function SelectValor({
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Value>) {
  return <SelectPrimitive.Value data-slot="select-value" {...props} />;
}

export function SelectGatilho({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Trigger>) {
  const campo = useCampo();

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      {...props}
      {...propsDoCampo(campo, props)}
      className={cn(
        "flex h-12 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors outline-none",
        "data-[placeholder]:text-muted-foreground",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50",
        "[&>span]:truncate",
        className,
      )}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDownIcon className="size-4 shrink-0 text-muted-foreground" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectConteudo({
  className,
  children,
  position = "popper",
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        className={cn(
          "relative z-50 max-h-(--radix-select-content-available-height) min-w-32 overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-lg",
          "data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=top]:-translate-y-1",
          className,
        )}
        {...props}
      >
        <Rolagem direcao="cima" />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)",
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <Rolagem direcao="baixo" />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

/**
 * Título de um bloco da lista ("Mais pedidos").
 *
 * **Só funciona dentro de `SelectGrupo`** — é exigência do Radix, e sem o
 * grupo a tela quebra em tempo de execução, não na compilação. O grupo também
 * é o que faz o leitor de tela anunciar "Cabelo, item 1 de 3 em Mais pedidos".
 */
export function SelectRotulo({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        "px-2 py-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        // 44px: o item da lista é alvo de toque como qualquer outro.
        "relative flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-md py-2 pr-8 pl-3 text-base outline-none select-none",
        "focus:bg-secondary focus:text-foreground",
        "data-disabled:pointer-events-none data-disabled:opacity-60",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="absolute right-3 flex size-4 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <CheckIcon className="size-4 text-accent-foreground" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparador({
  className,
  ...props
}: React.ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("-mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

/** Setas de rolagem, quando a lista não cabe na tela. */
function Rolagem({ direcao }: { direcao: "cima" | "baixo" }) {
  const Componente =
    direcao === "cima"
      ? SelectPrimitive.ScrollUpButton
      : SelectPrimitive.ScrollDownButton;
  const Icone = direcao === "cima" ? ChevronUpIcon : ChevronDownIcon;

  return (
    <Componente className="flex h-6 cursor-default items-center justify-center bg-popover text-muted-foreground">
      <Icone className="size-4" />
    </Componente>
  );
}

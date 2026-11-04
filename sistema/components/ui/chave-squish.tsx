"use client";

import SquishSwitch from "@/components/SquishSwitch";

import { cn } from "@/lib/utils";

/**
 * A chave de conclusão da agenda.
 *
 * Camada fina sobre o `SquishSwitch` do React Bits (MIT + Commons Clause —
 * pode ser usado dentro do produto; o que não pode é revender o componente
 * em si). O arquivo cru fica em `components/SquishSwitch.tsx`, onde a CLI
 * do shadcn o colocou: mexer no caminho faria a próxima atualização pela
 * CLI criar uma segunda cópia ao lado da primeira.
 *
 * Esta camada existe porque o SquishSwitch recebe cor e tamanho como
 * VALORES, não como classes. Sem ela, cada lugar que usa a chave repetiria
 * seis props de cor — e a sétima, escrita diferente, seria o começo da
 * divergência.
 *
 * ============================================================
 * AS CORES PRECISAM SER PASSADAS INTEIRAS
 * ============================================================
 *
 * `thumbColor` e `thumbOnColor` parecem opcionais e não são aqui. Quando
 * faltam, o componente deriva a bolinha com
 * `color-mix(in srgb, <trackOnColor> 19%, <trackColor>)` — e o nosso
 * `trackOnColor` é um DEGRADÊ. `color-mix` com degradê não é cor nenhuma:
 * a bolinha sairia transparente.
 */
export function ChaveSquish({
  ligada,
  aoMudar,
  desabilitada,
  rotulo,
  className,
}: {
  ligada: boolean;
  aoMudar: (ligada: boolean) => void;
  desabilitada?: boolean;
  /** Vai para o leitor de tela. A chave não tem texto ao lado dela. */
  rotulo: string;
  className?: string;
}) {
  return (
    <SquishSwitch
      checked={ligada}
      onChange={aoMudar}
      disabled={desabilitada}
      ariaLabel={rotulo}
      // Pequena: ela mora dentro de um cartão, ao lado de um ícone de 16px.
      // No tamanho de origem (76x38) vira o elemento mais pesado da linha.
      width={36}
      height={18}
      radius={9}
      trackColor="var(--secondary)"
      trackOnColor="var(--chave-ligada)"
      thumbColor="var(--card)"
      thumbOnColor="var(--primary-foreground)"
      // `className` cai no invólucro, não no botão — então é aqui que o
      // alvo de toque de 44px é garantido. O desenho encolheu; o alvo não,
      // porque polegar não acerta 18 pixels de altura.
      className={cn("size-11 justify-center", className)}
    />
  );
}

import { numeroDo } from "@/lib/capitulos";

/**
 * O sobretítulo de cada capítulo: o número, um traço e o assunto.
 *
 * O número sai de `lib/capitulos.ts` pelo `id` da seção — assim a
 * numeração nunca fica fora de ordem quando um capítulo muda de lugar.
 */
export function Rotulo({
  capitulo,
  children,
  className = "",
}: {
  capitulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`flex items-center gap-3 text-xs font-semibold tracking-[0.22em] text-ambar-500 uppercase ${className}`}
    >
      <span className="numeros text-graf-300">{numeroDo(capitulo)}</span>
      <span className="h-px w-8 bg-ambar-500/60" aria-hidden="true" />
      {children}
    </p>
  );
}

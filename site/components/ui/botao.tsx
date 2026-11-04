import type { ReactNode } from "react";

/**
 * Os dois botões do site.
 *
 * Âmbar é AÇÃO, e o manual é duro: um botão âmbar por tela, no máximo.
 * Por isso `tom="acao"` aparece uma vez por seção, nunca duas. Texto sobre
 * âmbar é sempre grafite-900 — branco sobre âmbar dá 2,01:1 e é proibido.
 */
export function Botao({
  href,
  children,
  tom = "acao",
  className = "",
  novaAba = false,
}: {
  href: string;
  children: ReactNode;
  tom?: "acao" | "contorno";
  className?: string;
  /**
   * Abre em outra aba — para o WhatsApp e o Instagram. O site continua
   * aberto atrás, e quem volta não perde o ponto em que estava.
   */
  novaAba?: boolean;
}) {
  const base =
    "group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-lg px-7 text-base font-semibold transition-[transform,background-color,border-color] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ambar-300 active:translate-y-px";

  const pintura =
    tom === "acao"
      ? "bg-ambar-500 text-graf-900 hover:bg-ambar-600"
      : "border border-graf-400 text-white hover:border-graf-300 hover:bg-graf-800";

  return (
    <a
      href={href}
      className={`${base} ${pintura} ${className}`}
      {...(novaAba ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <span className="relative z-10">{children}</span>
      {tom === "acao" && (
        // O brilho que atravessa o botão ao passar o mouse. Decoração pura,
        // por isso fica fora do fluxo e some para quem pediu menos movimento.
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-white/45 to-transparent transition-transform duration-700 group-hover:translate-x-full motion-reduce:hidden"
        />
      )}
    </a>
  );
}

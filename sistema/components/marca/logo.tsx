import Image from "next/image";

import { cn } from "@/lib/utils";

/**
 * Lockup horizontal do BARBOS.
 *
 * Duas versoes, trocadas por tema: a wordmark e grafite no claro e branca no
 * escuro. Regenerar em identidade/logo/gerar-logo.py — nao editar PNG na mao.
 */
export function Logo({
  className,
  largura = 132,
}: {
  className?: string;
  largura?: number;
}) {
  const altura = Math.round((largura * 400) / 1758);

  return (
    <span className={cn("inline-flex items-center", className)}>
      <Image
        src="/marca/logo.png"
        alt="BARBOS"
        width={largura}
        height={altura}
        priority
        className="dark:hidden"
      />
      <Image
        src="/marca/logo-escuro.png"
        alt=""
        aria-hidden="true"
        width={largura}
        height={altura}
        priority
        className="hidden dark:block"
      />
    </span>
  );
}

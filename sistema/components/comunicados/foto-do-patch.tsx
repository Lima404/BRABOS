import Image from "next/image";
import { ImageOff } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Uma foto de patch note no quadro 16:9, inteira (sem cortar), sobre o
 * fundo da superfície.
 *
 * `unoptimized` de propósito: o endereço é ASSINADO e vence em horas (ver
 * `lib/comunicados/fotos.ts`). O otimizador do Next guardaria uma cópia
 * pelo endereço, e cada página traz um endereço novo — cache que nunca
 * acerta, e mais uma configuração de domínio para manter. No editor o
 * endereço é `blob:`, da própria máquina, que o otimizador nem alcança.
 */
export function FotoDoPatch({
  url,
  alt,
  className,
}: {
  url: string;
  alt: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-lg border border-border bg-secondary",
        className,
      )}
    >
      {url ? (
        <Image
          src={url}
          alt={alt}
          fill
          unoptimized
          sizes="(min-width: 640px) 50vw, 100vw"
          className="object-contain"
        />
      ) : (
        // Assinatura falhou: o texto do patch note continua valendo, e o
        // quadro diz o que houve em vez de ficar vazio.
        <div className="flex size-full flex-col items-center justify-center gap-1 text-sm text-muted-foreground">
          <ImageOff className="size-5" aria-hidden="true" />
          Foto indisponível. Recarregue a página.
        </div>
      )}
    </div>
  );
}

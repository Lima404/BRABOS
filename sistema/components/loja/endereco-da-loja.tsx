"use client";

import { Link2 } from "lucide-react";

import { LinkCopiavel } from "@/components/ui/link-copiavel";

/**
 * O endereço público da loja, para a dona copiar.
 *
 * O domínio é montado pelo `LinkCopiavel` a partir de `window.location.origin`.
 * Já esteve escrito à mão aqui, e o resultado copiado era
 * `http://localhost:3000https://…/loja/gabriel-teste` — origem grudada num
 * endereço que já vinha completo.
 */
export function EnderecoDaLoja({ slug }: { slug: string }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Link2
          className="size-4 shrink-0 text-muted-foreground"
          aria-hidden="true"
        />
        <h2 className="text-sm font-semibold">Endereço da sua loja</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        É este endereço que vira o QR code do balcão. Ele não muda quando você
        renomeia a barbearia — o papel impresso continua valendo.
      </p>

      <LinkCopiavel caminho={`/loja/${slug}`} />
    </div>
  );
}

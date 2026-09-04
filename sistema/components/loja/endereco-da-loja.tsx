"use client";

import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * O endereço público da loja, para a dona copiar.
 *
 * O domínio vem de `window.location.origin` e não de uma variável de
 * ambiente: em desenvolvimento é localhost, em produção é o domínio real, e
 * um valor fixo aqui viraria um link quebrado impresso num QR code.
 */
export function EnderecoDaLoja({ slug }: { slug: string }) {
  const [copiado, setCopiado] = useState(false);

  const caminho = `/loja/${slug}`;

  async function copiar() {
    const url = `${window.location.origin}${caminho}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch (erro) {
      // Área de transferência bloqueada (http sem localhost, permissão
      // negada). O endereço continua visível na tela para copiar na mão.
      console.error("[BARBOS] não consegui copiar o endereço:", erro);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Link2 className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-sm font-semibold">Endereço da sua loja</h2>
      </div>

      <p className="text-sm text-muted-foreground">
        É este endereço que vira o QR code do balcão. Ele não muda quando você
        renomeia a barbearia — o papel impresso continua valendo.
      </p>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2.5 font-mono text-sm">
          {caminho}
        </code>

        <Button
          type="button"
          variant="outline"
          onClick={copiar}
          className="shrink-0"
        >
          {copiado ? <Check /> : <Copy />}
          {copiado ? "Copiado" : "Copiar link"}
        </Button>
      </div>

      {/* aria-live: quem usa leitor de tela ouve a confirmação, que de outro
          jeito só existiria como troca de ícone. */}
      <span aria-live="polite" className="sr-only">
        {copiado ? "Endereço copiado." : ""}
      </span>
    </div>
  );
}

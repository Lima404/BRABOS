"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Um endereço público para a dona copiar e mandar.
 *
 * O domínio vem de `window.location.origin`, nunca escrito à mão: em
 * desenvolvimento é `localhost`, na Vercel é o domínio de lá, e um valor fixo
 * no código vira link quebrado no dia em que o domínio mudar — ou, pior, um
 * QR code impresso apontando pro lugar errado.
 *
 * O `useEffect` não é preguiça: no servidor não existe `window`, então o
 * primeiro render mostra só o caminho, nas duas pontas igual. Montar a URL
 * completa já no render seria texto diferente entre servidor e cliente — o
 * erro de hidratação que a agenda já teve uma vez.
 */
export function LinkCopiavel({
  caminho,
  rotulo = "Copiar link",
}: {
  /** Começa com "/" — o domínio entra sozinho. */
  caminho: string;
  rotulo?: string;
}) {
  const [origem, setOrigem] = useState("");
  const [copiado, setCopiado] = useState(false);

  useEffect(() => setOrigem(window.location.origin), []);

  const enderecoCompleto = `${origem}${caminho}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(enderecoCompleto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch (erro) {
      // Área de transferência bloqueada (http fora de localhost, permissão
      // negada). O endereço continua na tela para copiar na mão.
      console.error("[BARBOS] não consegui copiar o endereço:", erro);
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="min-w-0 flex-1 truncate rounded-lg bg-secondary px-3 py-2.5 font-mono text-sm">
        {enderecoCompleto || caminho}
      </code>

      <Button
        type="button"
        variant="outline"
        onClick={copiar}
        className="shrink-0"
      >
        {copiado ? <Check /> : <Copy />}
        {copiado ? "Copiado" : rotulo}
      </Button>

      {/* aria-live: quem usa leitor de tela ouve a confirmação, que de outro
          jeito só existiria como troca de ícone. */}
      <span aria-live="polite" className="sr-only">
        {copiado ? "Endereço copiado." : ""}
      </span>
    </div>
  );
}

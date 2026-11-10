import { Esqueleto } from "@/components/ui/esqueleto";

/**
 * A forma do /patch-notes enquanto carrega: faixa da versão atual,
 * cabeçalho da versão e a grade de cartões. A mesma no `loading.tsx` e no
 * carregamento do componente, para nada pular quando o conteúdo chega.
 *
 * Mora FORA de `patch-notes.tsx` de propósito: aquele arquivo é
 * `"use client"`, e o `loading.tsx` (componente de servidor) importando um
 * export dele quebrou em desenvolvimento com "Element type is invalid.
 * Received a promise that resolves to: undefined". Sem `"use client"` aqui,
 * os dois lados importam o mesmo componente comum.
 */
export function FormaDosPatchNotes() {
  return (
    <div className="flex flex-col gap-6">
      <Esqueleto className="h-32" />
      <div className="flex flex-col gap-4">
        <Esqueleto className="h-36" />
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          <Esqueleto className="h-64" />
          <Esqueleto className="h-64" />
          <Esqueleto className="hidden h-64 2xl:block" />
        </div>
      </div>
    </div>
  );
}

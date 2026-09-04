import type { Metadata } from "next";

import { Amostruario } from "@/components/componentes/amostruario";

export const metadata: Metadata = { title: "Componentes" };

/**
 * Amostruário interno. De propósito FORA do menu lateral: é ferramenta de
 * construção, não tela de produto — o dono da barbearia não tem o que fazer
 * aqui. Chega por /componentes.
 */
export default function ComponentesPage() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Componentes</h1>
        <p className="text-muted-foreground">
          As peças da interface e quando usar cada uma. Troque o tema no
          cabeçalho para conferir os dois.
        </p>
      </div>

      <Amostruario />
    </div>
  );
}

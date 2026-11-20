"use client";

import { useLayoutEffect } from "react";

import { CLASSES_DAS_FONTES } from "@/app/fontes";
import { TelaDeErro } from "@/components/erro/tela-de-erro";
import { Logo } from "@/components/marca/logo";
import "./globals.css";

/**
 * A última rede: erro que nenhum outro `error.tsx` segurou.
 *
 * Cai aqui o que estoura FORA das telas do sistema — o login (`/entrar`,
 * onde o "Entrar" de uma versão antiga do app instalado falhava), o
 * layout raiz e o layout do sistema (a sessão e a barra lateral).
 *
 * Este arquivo SUBSTITUI o layout raiz quando entra: precisa do próprio
 * `<html>`/`<body>`, das fontes e dos estilos. Também não tem o
 * `ThemeProvider`, então o tema escuro é aplicado aqui à mão, lendo a
 * mesma chave que o `next-themes` grava (`theme`: light, dark ou system).
 */
export default function ErroGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  // Antes da pintura, para quem usa o tema escuro não ver um clarão.
  useLayoutEffect(() => {
    let tema: string | null = null;
    try {
      tema = localStorage.getItem("theme");
    } catch {
      // Armazenamento bloqueado: segue o sistema.
    }
    const escuro =
      tema === "dark" ||
      (tema !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", escuro);
  }, []);

  return (
    <html lang="pt-BR" className={`${CLASSES_DAS_FONTES} h-full`}>
      <body className="flex min-h-full flex-col">
        <title>BARBOS</title>
        <div className="faixa-barbearia" aria-hidden="true" />
        <main className="flex flex-1 flex-col items-center justify-center px-4 py-10">
          <Logo largura={140} />
          <TelaDeErro error={error} retry={retry} className="py-10" />
        </main>
      </body>
    </html>
  );
}

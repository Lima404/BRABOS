import type { Metadata, Viewport } from "next";

import { CLASSES_DAS_FONTES } from "@/app/fontes";
import { Providers } from "@/app/providers";
import { SITE } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  /**
   * A base de todo endereço absoluto que o Next monta sozinho —
   * `canonical`, Open Graph, Twitter. Sem ela o Next avisa no build e
   * cai no endereço do deploy, que muda a cada publicação: o link que o
   * WhatsApp pré-visualiza apontaria para um endereço de build.
   *
   * O endereço da Vercel continua servindo o site; o que esta linha diz
   * é qual é o endereço de CASA, para onde um buscador ou uma
   * pré-visualização deve apontar.
   */
  metadataBase: new URL(SITE),
  title: {
    default: "BARBOS",
    template: "%s · BARBOS",
  },
  description:
    "Gestão de agenda, serviços e estoque para barbearias. Sai do caderno.",
  applicationName: "BARBOS",
  icons: {
    icon: [{ url: "/marca/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/marca/icone-192.png", sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F6F8" },
    { media: "(prefers-color-scheme: dark)", color: "#0D0F12" },
  ],
  // A tela e tocada com uma mao so, de pe. Zoom fica liberado de proposito:
  // travar zoom em app de uso real e hostil com quem enxerga mal.
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${CLASSES_DAS_FONTES} h-full`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col">
        <Providers>
          {/* Unico aceno visual ao oficio, e no lugar que o manual manda:
              topo da tela de login e de todas as demais. */}
          <div className="faixa-barbearia" aria-hidden="true" />
          {children}
        </Providers>
      </body>
    </html>
  );
}

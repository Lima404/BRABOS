import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

import { Providers } from "@/app/providers";
import "./globals.css";

/**
 * Inter faz a interface inteira. Archivo Black assina a marca e nao aparece
 * em mais nenhum lugar — regra do identidade/design-guide.md.
 */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
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
      className={`${inter.variable} ${archivoBlack.variable} h-full`}
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

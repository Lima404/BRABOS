import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Inter faz tudo. Archivo Black assina a marca e nao aparece em mais
 * nenhum lugar — regra do identidade/design-guide.md.
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
  /**
   * Base de todo endereco absoluto que o Next monta sozinho. Sem ela, a
   * previa do link no WhatsApp aponta para o endereco do build, que muda
   * a cada publicacao — e e por WhatsApp que este site vai circular.
   */
  metadataBase: new URL(SITE),
  title: {
    default: "BARBOS — a barbearia sai do caderno",
    template: "%s · BARBOS",
  },
  description:
    "Agenda, serviços, equipe e estoque da barbearia numa tela só. " +
    "Sem caderno, sem planilha, sem perder horário.",
  applicationName: "BARBOS",
  alternates: { canonical: "/" },
  icons: {
    icon: [{ url: "/marca/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/marca/icone-192.png", sizes: "192x192" }],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "BARBOS",
    url: SITE,
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${archivoBlack.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-graf-950 text-white">
        <div className="faixa-barbearia" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}

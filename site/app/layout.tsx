import type { Metadata, Viewport } from "next";
import { Archivo_Black, Inter } from "next/font/google";

import { Cursor } from "@/components/ui/cursor";
import { FaixaProgresso } from "@/components/ui/faixa-progresso";
import { RolagemSuave } from "@/components/ui/rolagem-suave";
import { SITE } from "@/lib/site";
import "lenis/dist/lenis.css";
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
    default: "BARBOS · a barbearia sai do caderno",
    template: "%s · BARBOS",
  },
  description:
    "Agenda, serviços, equipe e estoque da barbearia numa tela só. " +
    "Sem caderno, sem burocracia, sem perder horário.",
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
    images: [{ url: "/heroi/cena.webp", width: 1600, height: 894 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
  width: "device-width",
  initialScale: 1,
};

/**
 * Uma linha que roda antes de a página pintar: marca o <html> com `js`.
 *
 * Todo efeito de "entrar na tela" do site (título que sai do desfoque,
 * lista que aparece em cascata) só esconde o conteúdo quando essa classe
 * existe. Se o JavaScript não rodar, a página aparece inteira, parada — e
 * nunca vazia.
 */
const MARCA_JS = "document.documentElement.classList.add('js')";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${archivoBlack.variable} h-full`}
      // A classe `js` entra antes de o React hidratar; sem isto ele
      // reclama de um atributo que mudou e que ele não escreveu.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MARCA_JS }} />
      </head>
      <body className="flex min-h-full flex-col bg-graf-950 text-white">
        <a
          href="#conteudo"
          className="sr-only z-[80] rounded-lg bg-ambar-500 px-4 py-3 font-semibold text-graf-900 focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
        >
          Pular para o conteúdo
        </a>
        <FaixaProgresso />
        <RolagemSuave />
        {children}
        <Cursor />
        {/* O grão de filme por cima de tudo. Decoração pura: não recebe
            clique, não entra no leitor de tela. */}
        <div aria-hidden="true" className="grao" />
      </body>
    </html>
  );
}

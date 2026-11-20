import { Archivo_Black, Inter } from "next/font/google";

/**
 * Inter faz a interface inteira. Archivo Black assina a marca e nao aparece
 * em mais nenhum lugar — regra do identidade/design-guide.md.
 *
 * Mora fora do `layout.tsx` porque o `global-error.tsx` SUBSTITUI o layout
 * raiz quando entra, e precisa das mesmas fontes por conta própria.
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

export const CLASSES_DAS_FONTES = `${inter.variable} ${archivoBlack.variable}`;

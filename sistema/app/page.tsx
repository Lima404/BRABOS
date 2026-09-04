import { redirect } from "next/navigation";

/**
 * A tela inicial e a agenda de hoje. Nao e painel, nao e resumo, nao e
 * grafico — regra do identidade/design-guide.md.
 */
export default function Home() {
  redirect("/agenda");
}

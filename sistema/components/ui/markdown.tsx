import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

import { linkSeguro } from "@/lib/comunicados/tipos";
import { cn } from "@/lib/utils";

/**
 * Texto escrito em markdown, desenhado com os tokens do sistema.
 *
 * Nasceu para as notificações (o texto do alerta, o resumo e as seções do
 * patch note), que o admin escreve com `### título`, `**negrito**` e
 * listas.
 *
 * ============================================================
 * O TEXTO APARECE NA TELA DE TODA BARBEARIA — POR ISSO NÃO HÁ HTML
 * ============================================================
 *
 * O `react-markdown` NÃO interpreta HTML colado no texto: um `<script>` ou
 * `<img onerror>` sai como texto, não como elemento. Não ligar o
 * `rehype-raw` aqui. E link só vira link se passar por `linkSeguro` — a
 * mesma regra do botão de link das seções (http(s) ou caminho do
 * sistema); o resto aparece como texto comum.
 *
 * **Quebra de linha simples continua quebrando** (`remark-breaks`). No
 * markdown puro, um Enter sozinho junta as linhas; as notificações
 * publicadas antes daqui foram escritas contando com a quebra, e
 * apareciam com `whitespace-pre-line`.
 *
 * **Os títulos do texto descem de nível.** A página já tem o título dela
 * e o da notificação; um `#` no texto vira `h3`, não um segundo `h1`.
 *
 * Imagem e tabela ficam de fora: foto tem lugar próprio no patch note
 * (com o visor), e tabela não cabe no celular.
 */
const COMPONENTES: Components = {
  // `###` é o título mais usado na prática (é o que o exemplo do Gabriel
  // usa), então ele também precisa se destacar do texto — não pode ficar
  // do tamanho do parágrafo só porque é o "nível 3".
  h1: ({ children }) => (
    <h3 className="text-2xl font-bold tracking-tight">{children}</h3>
  ),
  h2: ({ children }) => (
    <h4 className="text-xl font-semibold tracking-tight">{children}</h4>
  ),
  h3: ({ children }) => (
    <h5 className="text-lg font-semibold tracking-tight">{children}</h5>
  ),
  h4: ({ children }) => <h6 className="text-base font-semibold">{children}</h6>,
  h5: ({ children }) => <h6 className="text-base font-semibold">{children}</h6>,
  h6: ({ children }) => <h6 className="text-base font-semibold">{children}</h6>,
  p: ({ children }) => <p>{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  ul: ({ children }) => (
    <ul className="list-disc space-y-1 pl-6 marker:text-muted-foreground">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal space-y-1 pl-6 marker:text-muted-foreground">
      {children}
    </ol>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-border pl-4 text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="border-border" />,
  code: ({ children }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]">
      {children}
    </code>
  ),
  a: ({ href, children }) => {
    const endereco = linkSeguro(href);
    if (!endereco) return <>{children}</>;

    const classe =
      "font-medium text-foreground underline underline-offset-4 decoration-primary decoration-2 hover:decoration-foreground";

    // Tela do sistema na mesma aba; site de fora noutra, para a barbearia
    // não perder o BARBOS de vista (mesma regra do botão das seções).
    return endereco.startsWith("/") ? (
      <Link href={endereco} className={classe}>
        {children}
      </Link>
    ) : (
      <a
        href={endereco}
        target="_blank"
        rel="noopener noreferrer"
        className={classe}
      >
        {children}
      </a>
    );
  },
};

const FORA = ["img", "table", "thead", "tbody", "tr", "th", "td"];

export function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-base text-foreground [&>*+*]:mt-3 [&_li>p+p]:mt-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={COMPONENTES}
        disallowedElements={FORA}
        unwrapDisallowed
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/**
 * O mesmo texto, sem as marcas — para onde só cabe uma prévia de duas
 * linhas (o sino). Ali `### Comunicado` apareceria com os três `#`.
 *
 * Não é um conversor completo, e não precisa ser: a prévia é cortada em
 * duas linhas e leva para o texto inteiro.
 */
export function textoSemMarkdown(texto: string): string {
  return texto
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // [texto](link) → texto
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // ### título
    .replace(/^\s{0,3}>\s?/gm, "") // > citação
    .replace(/^\s*([-*+]|\d+[.)])\s+/gm, "") // - item / 1. item
    .replace(/^\s*([-*_]\s*){3,}$/gm, "") // ---
    .replace(/(\*\*|__)(.+?)\1/g, "$2") // **negrito**
    .replace(/(\*|_)(.+?)\1/g, "$2") // *itálico*
    .replace(/~~(.+?)~~/g, "$1") // ~~riscado~~
    .replace(/`([^`]*)`/g, "$1") // `código`
    .replace(/\s+/g, " ")
    .trim();
}

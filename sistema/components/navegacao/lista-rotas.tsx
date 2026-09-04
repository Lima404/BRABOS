"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { rotasVisiveis } from "@/components/navegacao/rotas";
import { cn } from "@/lib/utils";

/**
 * Os links de navegacao. Usada pela sidebar do desktop e pelo menu do celular.
 *
 * O item ativo e marcado por TRES coisas ao mesmo tempo — fundo, peso da fonte
 * e uma barra ambar a esquerda. Nunca so por cor: sol na vitrine lava cor da
 * tela, e o barbeiro precisa saber onde esta num relance.
 */
export function ListaRotas({
  logado,
  aoNavegar,
  className,
}: {
  logado: boolean;
  /** Chamado ao clicar — o menu do celular usa pra se fechar. */
  aoNavegar?: () => void;
  className?: string;
}) {
  const caminho = usePathname();

  // As rotas sao resolvidas AQUI, do lado do cliente, e nao recebidas prontas
  // de um componente de servidor. Cada rota carrega `icone`, que e uma funcao
  // de componente — e funcao nao atravessa a fronteira servidor -> cliente.
  // Passar a lista pronta rende "Only plain objects can be passed" e derruba
  // a pagina inteira com 500. So o booleano cruza.
  const rotas = rotasVisiveis(logado);

  return (
    <nav
      aria-label="Navegação principal"
      className={cn("flex flex-col gap-1", className)}
    >
      {rotas.map(({ href, rotulo, icone: Icone }) => {
        const ativo = caminho === href || caminho.startsWith(`${href}/`);

        return (
          <Link
            key={href}
            href={href}
            onClick={aoNavegar}
            aria-current={ativo ? "page" : undefined}
            className={cn(
              // min-h-11 = 44px, o alvo de toque minimo do design-guide.
              "flex min-h-11 items-center gap-3 rounded-lg border-l-[3px] border-transparent px-3 text-base transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              ativo
                ? "border-l-ambar-500 bg-secondary font-semibold text-foreground"
                : "font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Icone className="size-5 shrink-0" aria-hidden="true" />
            {rotulo}
          </Link>
        );
      })}
    </nav>
  );
}

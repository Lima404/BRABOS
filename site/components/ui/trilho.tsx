"use client";

import { useCapituloAtivo } from "@/components/ui/capitulo-ativo";
import { CAPITULOS } from "@/lib/capitulos";

/**
 * O trilho de capítulos, na lateral direita.
 *
 * Faz o papel dos pontinhos de paginação da referência, com uma diferença:
 * aqui cada ponto é um número e um link de verdade. Ele diz em que parte da
 * história a pessoa está, quanto falta, e leva a qualquer capítulo com um
 * clique — o Lenis desliza até lá.
 *
 * Só aparece em tela larga. No celular ele brigaria com o polegar e com o
 * conteúdo, e a faixa de progresso do topo já faz o serviço.
 */
export function Trilho() {
  const ativo = useCapituloAtivo();

  return (
    <nav
      aria-label="Capítulos"
      className="fixed top-1/2 right-4 z-40 hidden -translate-y-1/2 xl:block"
    >
      <ol className="flex flex-col items-end">
        {CAPITULOS.map((capitulo, i) => {
          const eAtivo = capitulo.id === ativo;
          return (
            <li key={capitulo.id}>
              <a
                href={`#${capitulo.id}`}
                aria-current={eAtivo ? "true" : undefined}
                className="group flex h-11 items-center justify-end gap-3 pl-3 focus-visible:outline-2 focus-visible:outline-ambar-300"
              >
                {/* O nome só aparece ao passar o mouse ou com o foco do
                    teclado. Fixo, ele encostava no conteúdo da direita —
                    no telefone, no mockup, nas colunas do rodapé. */}
                <span className="translate-x-2 rounded-md bg-graf-950/85 px-2 py-1 text-xs font-semibold whitespace-nowrap text-white opacity-0 backdrop-blur-sm transition-[opacity,translate] duration-300 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100">
                  {capitulo.nome}
                </span>
                <span
                  className={`numeros text-[11px] font-semibold transition-colors duration-300 ${
                    eAtivo ? "text-ambar-500" : "text-graf-400 group-hover:text-white"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  aria-hidden="true"
                  className={`h-px transition-[width,background-color] duration-500 ${
                    eAtivo ? "w-8 bg-ambar-500" : "w-3 bg-graf-500 group-hover:w-5"
                  }`}
                />
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

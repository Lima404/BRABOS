"use client";

import { Package } from "lucide-react";

import { EstadoVazio } from "@/components/ui/estado-vazio";
import type { Produto } from "@/lib/estoque/tipos";
import { moeda } from "@/lib/formato";
import { cn } from "@/lib/utils";

/**
 * Tabela de uma prateleira (Mercearia ou Produtos de Salão).
 *
 * Colunas: nome, unidades, preço. Sem caixas — o estoque é só em unidades.
 */
export function TabelaProdutos({
  id,
  titulo,
  descricao,
  produtos,
}: {
  /** Identificador estável pro `aria-labelledby` (sem acento/espaço). */
  id: string;
  titulo: string;
  descricao: string;
  produtos: Produto[];
}) {
  return (
    <section
      aria-labelledby={`tabela-${id}`}
      className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-4 py-3">
        <div>
          <h2 id={`tabela-${id}`} className="font-semibold">
            {titulo}
          </h2>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        <span className="text-sm text-muted-foreground">
          <span data-numero>{produtos.length}</span>{" "}
          {produtos.length === 1 ? "item" : "itens"}
        </span>
      </header>

      {produtos.length === 0 ? (
        <div className="flex flex-1 items-center justify-center p-4">
          <EstadoVazio
            icone={Package}
            titulo="Nenhum produto aqui"
            descricao="Cadastre acima e escolha esta prateleira no select."
          />
        </div>
      ) : (
        <div className="min-w-0 flex-1 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/40 text-muted-foreground">
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 text-right font-medium">Unidades</th>
                <th className="px-4 py-3 text-right font-medium">
                  Preço / unidade
                </th>
              </tr>
            </thead>
            <tbody>
              {produtos.map((p, i) => (
                <tr
                  key={p.id}
                  className={cn(
                    "border-b border-border last:border-b-0",
                    i % 2 === 1 && "bg-secondary/20",
                  )}
                >
                  <td className="px-4 py-3 font-medium">{p.nome}</td>
                  <td className="px-4 py-3 text-right">
                    <span data-numero>{p.unidades}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    <span data-numero>{moeda(p.precoCentavos)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

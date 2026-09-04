/**
 * Domínio do estoque.
 *
 * Uma tabela `produtos`, duas prateleiras na tela: Mercearia e Produtos de
 * Salão. O que separa é o `tipo`.
 */

export type TipoProduto = "mercearia" | "salao";

export const TIPOS_PRODUTO: TipoProduto[] = ["mercearia", "salao"];

export const NOME_DO_TIPO: Record<TipoProduto, string> = {
  mercearia: "Mercearia",
  salao: "Produtos de Salão",
};

export function ehTipoProduto(valor: string): valor is TipoProduto {
  return (TIPOS_PRODUTO as string[]).includes(valor);
}

export type Produto = {
  id: string;
  nome: string;
  unidades: number;
  /** Valor de uma unidade, em centavos. */
  precoCentavos: number;
  tipo: TipoProduto;
};

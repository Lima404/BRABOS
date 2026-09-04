import type { ItemDaComanda, MudancaDeConsumo } from "@/lib/agenda/tipos";

/**
 * Edição do consumo, do lado do rascunho.
 *
 * A tela mexe numa cópia (as `LinhaConsumo`) e só no "Salvar" a diferença
 * vira lista de mudanças. Isso existe porque o modal promete "Cancelar" —
 * e se cada toque no `+` já baixasse estoque, cancelar não cancelaria nada.
 */

export type LinhaConsumo = {
  /** Chave de render. Estável enquanto a linha existir na tela. */
  chave: string;
  /** Presente = a linha já está no banco (`itens_venda.id`). */
  itemId?: string;
  /** Presente = linha nova, ainda não lançada. */
  produtoId?: string;
  nome: string;
  /** Unitário, em centavos. */
  precoCentavos: number;
  quantidade: number;
};

export function linhaDoItem(item: ItemDaComanda): LinhaConsumo {
  return {
    chave: item.id,
    itemId: item.id,
    nome: item.nome,
    precoCentavos: item.precoCentavos,
    quantidade: item.quantidade,
  };
}

/** Soma das linhas, em centavos. */
export function totalDoConsumo(linhas: LinhaConsumo[]): number {
  return linhas.reduce((s, l) => s + l.precoCentavos * l.quantidade, 0);
}

/**
 * O que mudou entre o que estava no banco e o que está na tela.
 *
 * Três casos, nesta ordem de leitura:
 *   - item que sumiu da tela  → quantidade 0 (a RPC apaga)
 *   - item com número diferente → a nova quantidade
 *   - linha sem `itemId`      → produto a lançar agora
 *
 * Devolve lista vazia quando nada mudou, e aí a tela nem chama o servidor.
 */
export function mudancasDoConsumo(
  originais: ItemDaComanda[],
  linhas: LinhaConsumo[],
): MudancaDeConsumo[] {
  const mudancas: MudancaDeConsumo[] = [];

  const naTela = new Map(
    linhas.filter((l) => l.itemId).map((l) => [l.itemId as string, l]),
  );

  for (const original of originais) {
    const linha = naTela.get(original.id);

    if (!linha) {
      mudancas.push({ itemId: original.id, quantidade: 0 });
    } else if (linha.quantidade !== original.quantidade) {
      mudancas.push({ itemId: original.id, quantidade: linha.quantidade });
    }
  }

  for (const linha of linhas) {
    if (linha.produtoId && linha.quantidade > 0) {
      mudancas.push({
        produtoId: linha.produtoId,
        quantidade: linha.quantidade,
      });
    }
  }

  return mudancas;
}

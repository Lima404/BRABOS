"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * Pedido na loja pública. Roda sem sessão — o cliente do QR não tem conta.
 *
 * A barreira de verdade é a RPC `confirmar_carrinho_loja` (migração 0012):
 * valida slug, produtos e estoque e baixa tudo numa venda. Aqui só empacota
 * o resultado em português e revalida a vitrine.
 *
 * Se a 0012 ainda não rodou, cai na RPC de um item (0009) em sequência —
 * vários produtos viram várias vendas, mas o estoque ainda baixa.
 */

export type ResultadoCompra =
  | {
      ok: true;
      /** Soma das unidades no pedido. */
      quantidade: number;
      /** Quantidade de produtos distintos. */
      itens: number;
      totalCentavos: number;
    }
  | { ok: false; erro: string };

type RespostaRpc = {
  ok: boolean;
  erro?: string;
  quantidade?: number;
  itens?: number;
  total_centavos?: number;
};

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

export type ItemDoPedido = {
  produtoId: string;
  quantidade: number;
};

export async function confirmarCompra(entrada: {
  slug: string;
  itens: ItemDoPedido[];
  /** Agendamento do dia a que a compra é lançada. Ausente = compra avulsa. */
  agendamentoId?: string | null;
}): Promise<ResultadoCompra> {
  try {
    const slug = entrada.slug.trim();
    if (!slug) return { ok: false, erro: "Loja inválida." };

    const itens = normalizarItens(entrada.itens);
    if (!itens) {
      return { ok: false, erro: "Escolha pelo menos um produto (1 a 99 cada)." };
    }

    const supabase = await criarClienteServidor();
    const agendamentoId = entrada.agendamentoId ?? null;

    const { data, error } = await supabase.rpc("confirmar_carrinho_loja", {
      p_slug: slug,
      p_itens: itens.map((i) => ({
        produto_id: i.produtoId,
        quantidade: i.quantidade,
      })),
      p_agendamento_id: agendamentoId,
    });

    if (error) {
      console.error(
        "[BARBOS] confirmar carrinho:",
        error.code ?? "",
        error.message,
      );

      // Sem a 0012, a de um item ainda funciona — um pedido vira N vendas.
      if (
        error.message?.includes("confirmar_carrinho_loja") ||
        error.code === "PGRST202"
      ) {
        return confirmarUmAUm(supabase, slug, itens, agendamentoId);
      }

      return {
        ok: false,
        erro: "Não consegui confirmar o pedido. Tente de novo.",
      };
    }

    const resposta = data as RespostaRpc;

    if (!resposta?.ok) {
      return {
        ok: false,
        erro: resposta?.erro ?? "Não consegui confirmar o pedido.",
      };
    }

    revalidatePath(`/loja/${slug}`);
    revalidatePath("/estoque");

    return {
      ok: true,
      quantidade: resposta.quantidade ?? itens.reduce((s, i) => s + i.quantidade, 0),
      itens: resposta.itens ?? itens.length,
      totalCentavos: resposta.total_centavos ?? 0,
    };
  } catch (erro) {
    console.error("[BARBOS] confirmar compra lançou exceção:", erro);

    const texto = [
      (erro as Error)?.message,
      (erro as { cause?: { message?: string } })?.cause?.message,
    ]
      .filter(Boolean)
      .join(" ");

    if (FALHA_DE_TRANSPORTE.test(texto)) {
      return {
        ok: false,
        erro: "Não consegui falar com o servidor. Tente de novo em alguns segundos.",
      };
    }

    return {
      ok: false,
      erro: "Algo deu errado ao confirmar. Se continuar, recarregue a página.",
    };
  }
}

function normalizarItens(itens: ItemDoPedido[]): ItemDoPedido[] | null {
  if (!Array.isArray(itens) || itens.length === 0 || itens.length > 40) {
    return null;
  }

  const mapa = new Map<string, number>();
  for (const item of itens) {
    if (
      !item?.produtoId ||
      !Number.isInteger(item.quantidade) ||
      item.quantidade < 1 ||
      item.quantidade > 99
    ) {
      return null;
    }
    mapa.set(item.produtoId, (mapa.get(item.produtoId) ?? 0) + item.quantidade);
  }

  const saida: ItemDoPedido[] = [];
  for (const [produtoId, quantidade] of mapa) {
    if (quantidade > 99) return null;
    saida.push({ produtoId, quantidade });
  }
  return saida.length > 0 ? saida : null;
}

/** Fallback sem migração 0012: confirma item a item com a RPC antiga. */
async function confirmarUmAUm(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  slug: string,
  itens: ItemDoPedido[],
  agendamentoId: string | null,
): Promise<ResultadoCompra> {
  let totalCentavos = 0;
  let quantidade = 0;

  for (const item of itens) {
    const { data, error } = await supabase.rpc("confirmar_compra_loja", {
      p_slug: slug,
      p_produto_id: item.produtoId,
      p_quantidade: item.quantidade,
      p_agendamento_id: agendamentoId,
    });

    if (error) {
      console.error("[BARBOS] confirmar item (fallback):", error.message);
      if (error.message?.includes("confirmar_compra_loja")) {
        return {
          ok: false,
          erro: "A compra ainda não está ligada no banco. Rode as migrações 0007, 0009 e 0012.",
        };
      }
      return {
        ok: false,
        erro:
          quantidade > 0
            ? "Parte do pedido entrou, mas um item falhou. Confira o estoque no balcão."
            : "Não consegui confirmar o pedido. Tente de novo.",
      };
    }

    const resposta = data as RespostaRpc;
    if (!resposta?.ok) {
      return {
        ok: false,
        erro:
          quantidade > 0
            ? `${resposta?.erro ?? "Um item falhou."} Parte do pedido já foi registrada.`
            : (resposta?.erro ?? "Não consegui confirmar o pedido."),
      };
    }

    totalCentavos += resposta.total_centavos ?? 0;
    quantidade += resposta.quantidade ?? item.quantidade;
  }

  revalidatePath(`/loja/${slug}`);
  revalidatePath("/estoque");

  return {
    ok: true,
    quantidade,
    itens: itens.length,
    totalCentavos,
  };
}

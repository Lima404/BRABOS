import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { Produto, TipoProduto } from "@/lib/estoque/tipos";

/**
 * Camada de dados do estoque — tabela `produtos` (migração 0004).
 *
 * `server-only` garante erro de build se alguém importar num componente de
 * cliente. O RLS já limita as linhas à barbearia logada.
 */

type LinhaProduto = {
  id: string;
  nome: string;
  unidades: number;
  preco_centavos: number;
  tipo: TipoProduto;
};

function produtoDaLinha(l: LinhaProduto): Produto {
  return {
    id: l.id,
    nome: l.nome,
    unidades: l.unidades,
    precoCentavos: l.preco_centavos,
    tipo: l.tipo,
  };
}

const CAMPOS = "id, nome, unidades, preco_centavos, tipo";

export async function listarProdutos(): Promise<Produto[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("produtos")
    .select(CAMPOS)
    .order("nome", { ascending: true });

  if (error) {
    console.error("[BARBOS] erro ao ler produtos:", error.message);
    throw new Error("Não foi possível carregar o estoque.");
  }

  return (data as LinhaProduto[]).map(produtoDaLinha);
}

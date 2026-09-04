import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { ehTipoProduto, type TipoProduto } from "@/lib/estoque/tipos";
import { hojeNaBarbearia } from "@/lib/formato";

/**
 * Dados da vitrine pública.
 *
 * Lê a view `public.lojas` — nunca `barbearias` direto (RLS).
 */

export type Loja = {
  id: string;
  slug: string;
  nome: string;
};

/** `null` quando o apelido não existe ou a loja está fechada. */
export async function obterLojaPorSlug(slug: string): Promise<Loja | null> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("lojas")
    .select("id, slug, nome")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("[BARBOS] erro ao ler a loja:", error.message);
    return null;
  }

  return data ? (data as Loja) : null;
}

/**
 * Uma linha do seletor "Lançar em".
 *
 * `clienteNome` é opcional no tipo porque já foi opcional na prática: a 0009
 * escondia o nome de quem não fosse a dona, e a 0010 abriu para todo mundo,
 * por decisão do Gabriel. Um banco onde a 0010 ainda não rodou continua
 * devolvendo nulo, então o tipo admite os dois e a tela cai no serviço.
 */
export type ClienteDoDia = {
  id: string;
  /** HH:MM */
  horario: string;
  servico: string;
  clienteNome: string | null;
};

/**
 * Agendamentos de hoje da loja, para o seletor da compra.
 *
 * Lista vazia quando a migração 0009 ainda não rodou: o seletor some e a
 * compra continua funcionando como avulsa. Loja fora do ar por causa de um
 * seletor seria trocar o principal pelo acessório.
 */
export async function listarClientesDoDia(
  slug: string,
): Promise<ClienteDoDia[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase.rpc("clientes_do_dia_loja", {
    p_slug: slug,
    p_data: hojeNaBarbearia(),
  });

  if (error) {
    console.error(
      "[BARBOS] clientes do dia indisponíveis (rode a migração 0009):",
      error.message,
    );
    return [];
  }

  return ((data ?? []) as ClienteDoDia[]).filter(
    (c) => c && typeof c.id === "string" && typeof c.horario === "string",
  );
}

/** Item da vitrine. `unidades` limita o que o cliente pode colocar no pedido. */
export type ProdutoDaLoja = {
  id: string;
  nome: string;
  precoCentavos: number;
  /** Quantidade em estoque no momento do GET. */
  unidades: number;
  disponivel: boolean;
  tipo: TipoProduto;
};

type LinhaDaView = {
  id: string;
  nome: string;
  preco_centavos: number;
  unidades: number;
  tipo: string;
};

/**
 * GET público via `loja_produtos` (funciona sem login).
 *
 * A regra de negócio fica aqui, não em migração:
 * mercearia ou salão, unidades >= 1 e preço > 0.
 */
export async function listarProdutosDaLoja(
  lojaId: string,
): Promise<ProdutoDaLoja[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("loja_produtos")
    .select("id, nome, preco_centavos, unidades, tipo")
    .eq("barbearia_id", lojaId)
    .order("nome", { ascending: true });

  if (error) {
    console.error(
      "[BARBOS] view loja_produtos incompleta, tentando formato antigo:",
      error.message,
    );
    return listarPelaViewAntiga(supabase, lojaId);
  }

  return ((data ?? []) as LinhaDaView[])
    .filter(
      (p) =>
        ehTipoProduto(p.tipo) &&
        p.unidades >= 1 &&
        p.preco_centavos > 0,
    )
    .map((p) => ({
      id: p.id,
      nome: p.nome,
      precoCentavos: p.preco_centavos,
      unidades: p.unidades,
      disponivel: true,
      tipo: p.tipo as TipoProduto,
    }));
}

async function listarPelaViewAntiga(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
  lojaId: string,
): Promise<ProdutoDaLoja[]> {
  const { data, error } = await supabase
    .from("loja_produtos")
    .select("id, nome, preco_centavos, disponivel")
    .eq("barbearia_id", lojaId)
    .order("nome", { ascending: true });

  if (error) {
    console.error("[BARBOS] erro ao ler produtos da loja:", error.message);
    throw new Error("Não foi possível carregar os produtos.");
  }

  // View antiga = só mercearia.
  return (
    data as {
      id: string;
      nome: string;
      preco_centavos: number;
      disponivel: boolean;
    }[]
  )
    .filter((l) => l.preco_centavos > 0 && l.disponivel)
    .map((l) => ({
      id: l.id,
      nome: l.nome,
      precoCentavos: l.preco_centavos,
      // View antiga não traz unidades — o carrinho limita em 99.
      unidades: 99,
      disponivel: true,
      tipo: "mercearia" as const,
    }));
}

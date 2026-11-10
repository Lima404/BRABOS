import "server-only";

import { clienteSemSessao } from "@/lib/pagamento/asaas";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * O que o pedido do endereço permite fazer no cadastro.
 *
 *   pode        pago e ainda sem conta: o formulário abre
 *   aguardando  o checkout existe, o Asaas ainda não confirmou
 *   usado       pago, mas já virou uma conta
 *   recusado    cancelado, expirado ou estornado
 *   ausente     sem pedido, ou um id que não existe
 *   erro        não deu para perguntar ao banco
 */
export type PedidoNoCadastro = "pode" | "aguardando" | "usado" | "recusado" | "ausente" | "erro";

export async function pedidoParaCadastro(pedido: unknown): Promise<PedidoNoCadastro> {
  if (typeof pedido !== "string" || !UUID.test(pedido)) return "ausente";

  const { data, error } = await clienteSemSessao()
    .rpc("situacao_do_pedido", { p_id: pedido })
    .maybeSingle<{ situacao: string; plano: string; livre: boolean }>();

  if (error) {
    console.error("[BARBOS] falha ao ler o pedido:", error.message);
    return "erro";
  }
  if (!data) return "ausente";
  if (data.situacao === "aguardando") return "aguardando";
  if (data.situacao !== "pago") return "recusado";
  return data.livre ? "pode" : "usado";
}

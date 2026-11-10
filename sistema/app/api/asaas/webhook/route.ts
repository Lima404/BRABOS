import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { clienteSemSessao } from "@/lib/pagamento/asaas";

/**
 * POST /api/asaas/webhook — os avisos do Asaas.
 *
 * Cada pagamento que entra, atrasa, volta ou é estornado chega aqui, e a
 * função `asaas_evento` (0041) decide o que muda: o pedido, o prazo e, no
 * fim, `barbearias.pagamento_ativo`.
 *
 * Duas portas, e as duas cobram o mesmo segredo:
 *
 *   - aqui, o cabeçalho `asaas-access-token` (é o "token de autenticação"
 *     configurado no webhook, no painel do Asaas);
 *   - no banco, o mesmo valor (tabela `segredos`). Sem isso a chave anon,
 *     que é pública, conseguiria chamar a função direto e liberar conta.
 *
 * Responde rápido e quase sempre 200: o Asaas PAUSA a fila inteira do
 * webhook depois de falhas seguidas, e aí nenhum pagamento seguinte chega.
 * Só devolve erro quando o banco não gravou, para o Asaas tentar de novo.
 *
 * Está em ROTAS_ABERTAS no proxy: quem chama é o Asaas, sem sessão.
 */
export async function POST(request: Request) {
  const segredo = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  const recebido = request.headers.get("asaas-access-token") ?? "";
  if (!segredo || !iguais(segredo, recebido)) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }

  let evento: unknown;
  try {
    evento = await request.json();
  } catch {
    return NextResponse.json({ erro: "Corpo inválido." }, { status: 400 });
  }

  const { data, error } = await clienteSemSessao().rpc("asaas_evento", {
    p_segredo: segredo,
    p_evento: evento,
  });
  if (error) {
    console.error("[BARBOS] webhook do Asaas não gravou:", error.message);
    return NextResponse.json({ erro: "Não gravou." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, resultado: data });
}

/** Compara sem vazar pelo tempo de resposta quantos caracteres bateram. */
function iguais(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { hojeNaBarbearia } from "@/lib/formato";
import { SIMBOLO_BASE64 } from "@/lib/pagamento/imagem";
import { enderecoDeVolta, PLANOS, PLANOS_NO_SITE, type Plano } from "@/lib/pagamento/planos";
import { exigirConfig } from "@/lib/supabase/config";

/**
 * A conversa com o Asaas, só do lado do servidor.
 *
 * Duas variáveis, nenhuma com `NEXT_PUBLIC_`:
 *
 *   ASAAS_API_KEY        a chave da API. O ambiente sai do prefixo dela:
 *                        `$aact_prod_` fala com a produção, `$aact_hmlg_`
 *                        com o sandbox.
 *   ASAAS_WEBHOOK_TOKEN  o segredo do webhook. O Asaas manda ele no
 *                        cabeçalho `asaas-access-token`, e o banco cobra o
 *                        mesmo valor (tabela `segredos`) antes de mexer em
 *                        qualquer pagamento. Ver a 0041.
 */
export function configDoAsaas(): { chave: string; base: string; segredo: string } | null {
  const chave = process.env.ASAAS_API_KEY?.trim();
  const segredo = process.env.ASAAS_WEBHOOK_TOKEN?.trim();
  if (!chave || !segredo) return null;
  const base = chave.startsWith("$aact_hmlg_")
    ? "https://api-sandbox.asaas.com/v3"
    : "https://api.asaas.com/v3";
  return { chave, base, segredo };
}

/**
 * Abre uma sessão de checkout no Asaas para um pedido.
 *
 * O `pedido` vai como `externalReference` e volta no endereço de sucesso: é
 * ele que liga o pagamento à conta que vai ser criada. Expira em uma hora
 * — tempo de sobra para pagar um PIX, e pouco para um link esquecido numa
 * aba virar pagamento sem dono.
 */
export async function criarCheckout(
  plano: Plano,
  pedido: string,
): Promise<{ id: string; link: string }> {
  const config = configDoAsaas();
  if (!config) throw new Error("Asaas não configurado (ASAAS_API_KEY e ASAAS_WEBHOOK_TOKEN).");

  const p = PLANOS[plano];
  const corpo: Record<string, unknown> = {
    billingTypes: p.meios,
    chargeTypes: p.cobrancas,
    minutesToExpire: 60,
    externalReference: pedido,
    callback: {
      successUrl: enderecoDeVolta(pedido),
      cancelUrl: PLANOS_NO_SITE,
      expiredUrl: PLANOS_NO_SITE,
    },
    items: [
      {
        name: p.nome,
        description: p.descricao,
        quantity: 1,
        value: p.centavos / 100,
        imageBase64: SIMBOLO_BASE64,
      },
    ],
  };
  if (plano === "mensal") {
    corpo.subscription = { cycle: "MONTHLY", nextDueDate: hojeNaBarbearia() };
  }
  if ("parcelas" in p) {
    corpo.installment = { maxInstallmentCount: p.parcelas };
  }

  const resposta = await fetch(`${config.base}/checkouts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      access_token: config.chave,
      "User-Agent": "BARBOS-sistema/1.0",
    },
    body: JSON.stringify(corpo),
    cache: "no-store",
  });
  const dados = (await resposta.json().catch(() => ({}))) as {
    id?: string;
    link?: string;
    errors?: { code: string; description: string }[];
  };
  if (!resposta.ok || !dados.id || !dados.link) {
    const motivo = (dados.errors ?? []).map((e) => `${e.code}: ${e.description}`).join("; ");
    throw new Error(`checkout recusado pelo Asaas (HTTP ${resposta.status}) ${motivo}`);
  }
  return { id: dados.id, link: dados.link };
}

/**
 * Um cliente do Supabase SEM sessão, para as chamadas que não vêm de quem
 * está logado: o webhook do Asaas e o registro do pedido.
 *
 * Usa a chave anon, como o navegador. O que o protege não é a chave, é o
 * segredo que as funções do banco cobram (`registrar_pedido`,
 * `asaas_evento`). A service_role continua fora deste projeto.
 */
export function clienteSemSessao() {
  const { url, chave } = exigirConfig();
  return createClient(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

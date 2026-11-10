import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { linkDoWhatsApp } from "@/lib/formato";
import { clienteSemSessao, configDoAsaas, criarCheckout } from "@/lib/pagamento/asaas";
import {
  ehPlano,
  NOME_DO_PLANO,
  PLANOS_NO_SITE,
  WHATSAPP_DO_BARBOS,
} from "@/lib/pagamento/planos";
import { criarClienteServidor } from "@/lib/supabase/servidor";

/**
 * GET /assinar?plano=mensal|anual-cartao|anual-pix
 *
 * É para onde vão os botões da seção de planos do site (e os da tela de
 * assinatura daqui). Abre um checkout no Asaas e manda a pessoa para lá.
 *
 *   1. sorteia o pedido;
 *   2. abre o checkout com o pedido como referência;
 *   3. grava o pedido no banco (`registrar_pedido`, com o segredo);
 *   4. redireciona para a página de pagamento do Asaas.
 *
 * Quem já está logado (a barbearia renovando) leva a conta junto: o pedido
 * nasce ligado a ela, e o pagamento a libera sem passar pelo cadastro.
 *
 * Qualquer falha cai no WhatsApp com a escolha escrita, nunca numa tela de
 * erro: quem clicou em pagar quer pagar, e uma pessoa resolve.
 */
export async function GET(request: NextRequest) {
  const plano = request.nextUrl.searchParams.get("plano");
  if (!ehPlano(plano)) {
    return NextResponse.redirect(PLANOS_NO_SITE, 303);
  }

  const paraOWhatsApp = () =>
    NextResponse.redirect(
      linkDoWhatsApp(
        WHATSAPP_DO_BARBOS,
        `Olá! Quero assinar o BARBOS no plano ${NOME_DO_PLANO[plano].toLowerCase()}.`,
      ) ?? PLANOS_NO_SITE,
      303,
    );

  const config = configDoAsaas();
  if (!config) return paraOWhatsApp();

  // A sessão é opcional aqui. Se o Supabase não responder, a pessoa segue
  // como visitante: paga e cria a conta pelo caminho normal.
  let barbearia: string | null = null;
  try {
    const supabase = await criarClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    barbearia = user?.id ?? null;
  } catch {
    barbearia = null;
  }

  const pedido = randomUUID();
  try {
    const checkout = await criarCheckout(plano, pedido);
    const { error } = await clienteSemSessao().rpc("registrar_pedido", {
      p_segredo: config.segredo,
      p_id: pedido,
      p_plano: plano,
      p_checkout: checkout.id,
      p_barbearia: barbearia,
    });
    if (error) throw new Error(`registrar_pedido: ${error.message}`);

    return NextResponse.redirect(checkout.link, 303);
  } catch (erro) {
    console.error("[BARBOS] falha ao abrir o checkout:", erro);
    return paraOWhatsApp();
  }
}

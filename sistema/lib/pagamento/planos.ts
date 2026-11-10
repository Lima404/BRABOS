/**
 * Os três jeitos de pagar o plano do BARBOS, como o checkout do Asaas os
 * entende.
 *
 * O PREÇO ESTÁ ESCRITO EM DOIS LUGARES: aqui, que é o que o Asaas cobra, e
 * em `site/lib/planos.ts`, que é o que o site mostra. São dois projetos na
 * Vercel e um não importa o outro. Mudou um, mude o outro no mesmo commit —
 * senão o site promete um valor e o checkout cobra outro.
 *
 * Em centavos, como todo dinheiro do sistema.
 */
export const PLANOS = {
  mensal: {
    centavos: 9798,
    nome: "BARBOS plano mensal",
    descricao: "Acesso completo ao sistema BARBOS, com suporte 24h. Cobrado no cartão todo mês.",
    meios: ["CREDIT_CARD"],
    cobrancas: ["RECURRENT"],
  },
  "anual-cartao": {
    centavos: 112800,
    nome: "BARBOS plano anual",
    descricao: "Acesso completo ao sistema BARBOS por 12 meses, com suporte 24h. À vista ou em até 12x no cartão.",
    meios: ["CREDIT_CARD"],
    cobrancas: ["DETACHED", "INSTALLMENT"],
    parcelas: 12,
  },
  "anual-pix": {
    centavos: 101520,
    nome: "BARBOS plano anual",
    descricao: "Acesso completo ao sistema BARBOS por 12 meses, com suporte 24h. À vista no PIX, com 10% de desconto.",
    meios: ["PIX"],
    cobrancas: ["DETACHED"],
  },
} as const;

export type Plano = keyof typeof PLANOS;

export function ehPlano(valor: unknown): valor is Plano {
  return typeof valor === "string" && Object.hasOwn(PLANOS, valor);
}

/** Como o plano aparece escrito para a pessoa. */
export const NOME_DO_PLANO: Record<Plano | "manual", string> = {
  mensal: "Mensal",
  "anual-cartao": "Anual no cartão",
  "anual-pix": "Anual no PIX",
  manual: "Liberado pelo BARBOS",
};

/**
 * O WhatsApp do BARBOS (o mesmo do site). É a saída de toda tela de
 * pagamento: se o checkout falhar ou a pessoa travar, ela fala com gente.
 */
export const WHATSAPP_DO_BARBOS = "84996308743";

/** Onde moram os planos no site, para quem chega sem escolher nenhum. */
export const PLANOS_NO_SITE = "https://site.barboss.com.br/#planos";

/**
 * Para onde o Asaas devolve a pessoa depois de pagar.
 *
 * Fica no site, e não aqui, por uma regra do Asaas: o endereço de volta tem
 * que ser do domínio cadastrado em Minha Conta > Informações, que hoje é
 * `site.barboss.com.br`. A página de lá repassa o pedido para o cadastro
 * daqui.
 */
export function enderecoDeVolta(pedido: string): string {
  return `https://site.barboss.com.br/obrigado?pedido=${pedido}`;
}

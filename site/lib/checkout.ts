import { SISTEMA } from "@/lib/site";

/** As três formas de pagar o plano. */
export type FormaDePagar = "mensal" | "anualCartao" | "anualPix";

/** O nome de cada forma no endereço do sistema. */
const PLANO_NO_SISTEMA: Record<FormaDePagar, string> = {
  mensal: "mensal",
  anualCartao: "anual-cartao",
  anualPix: "anual-pix",
};

/**
 * Para onde vai o botão de pagar: a rota `/assinar` do sistema.
 *
 * O site é estático e não fala com o Asaas. Quem abre o checkout é o
 * sistema, que sorteia um pedido para cada clique, manda a pessoa para a
 * página de pagamento do Asaas e, depois de pago, a traz de volta para o
 * cadastro com esse pedido (ver `sistema/AGENTS.md`, "Pagamento").
 *
 * Se o sistema não conseguir abrir o checkout, ele mesmo manda a pessoa
 * para o WhatsApp com a escolha escrita: o botão nunca é um beco.
 */
export function destinoDoPagamento(forma: FormaDePagar): string {
  return `${SISTEMA}/assinar?plano=${PLANO_NO_SISTEMA[forma]}`;
}

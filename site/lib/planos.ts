/**
 * O plano do BARBOS: um pacote só, com o sistema inteiro e suporte 24h.
 *
 * O PREÇO ESTÁ ESCRITO EM DOIS LUGARES: aqui, que é o que o site mostra,
 * e em `sistema/lib/pagamento/planos.ts`, que é o que o Asaas cobra. São
 * dois projetos na Vercel e um não importa o outro. Mudou um, mude o outro
 * no mesmo commit.
 *
 * Tudo em centavos, para a conta do desconto não errar no arredondamento.
 */
export const PLANO = {
  mensal: 9798,
  anual: 112800,
  /** O desconto de quem paga o plano anual no PIX, à vista. */
  descontoPix: 0.1,
  /** Em quantas vezes o plano anual pode ser parcelado no cartão. */
  parcelas: 12,
} as const;

/** O anual no PIX, já com o desconto: R$ 1.015,20. */
export const ANUAL_NO_PIX = Math.round(PLANO.anual * (1 - PLANO.descontoPix));

/** "R$ 1.128,00" */
export function reais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/** O que vem no pacote. É a mesma lista para o mensal e para o anual. */
export const INCLUI = [
  "Acesso completo ao sistema",
  "Agenda, serviços, equipe e estoque numa tela só",
  "Página de agendamento para os seus clientes",
  "Dashboard com o caixa do mês",
  "Suporte 24h",
] as const;

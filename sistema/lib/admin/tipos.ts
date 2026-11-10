/**
 * Domínio do Painel Admin (migração 0044).
 *
 * A situação do pagamento e as somas vêm PRONTAS do banco
 * (`admin_barbearias`, `admin_movimento`). Nada aqui recalcula a regra dos
 * 7 dias de tolerância nem o que entra no caixa: isso tem uma cópia só, lá.
 */

/**
 *   em_dia      pagou, dentro do prazo
 *   liberada    liberada à mão (plano manual), sem vencimento
 *   tolerancia  mensalidade vencida, ainda dentro dos 7 dias
 *   bloqueada   sem acesso: o sistema manda para /assinatura
 */
export type SituacaoPagamento = "em_dia" | "liberada" | "tolerancia" | "bloqueada";

export type BarbeariaNoPainel = {
  id: string;
  nome: string;
  slug: string;
  telefone: string | null;
  email: string | null;
  /** timestamptz */
  criadaEm: string;
  /** timestamptz do último login. `null` = nunca entrou. */
  ultimoAcesso: string | null;
  admin: boolean;
  pagamentoAtivo: boolean;
  /** mensal | anual-cartao | anual-pix | manual. `null` sem pedido nenhum. */
  plano: string | null;
  /** AAAA-MM-DD — último dia com acesso (mensal já com os 7 dias). */
  valeAte: string | null;
  situacao: SituacaoPagamento;
};

export type MovimentoDaBarbearia = {
  barbeariaId: string;
  /** Marcados no período, sem os cancelados. */
  agendamentos: number;
  /** Serviços que entraram no caixa (agenda concluída + registro manual). */
  atendimentos: number;
  servicoCentavos: number;
  vendas: number;
  lojaCentavos: number;
};

export const NOME_DO_PLANO: Record<string, string> = {
  mensal: "Mensal",
  "anual-cartao": "Anual no cartão",
  "anual-pix": "Anual no PIX",
  manual: "Liberada à mão",
};

export const ROTULO_DA_SITUACAO: Record<SituacaoPagamento, string> = {
  em_dia: "Em dia",
  liberada: "Liberada",
  tolerancia: "Em tolerância",
  bloqueada: "Bloqueada",
};

/**
 * "Pagou?" — a pergunta do filtro. Tolerância conta como inadimplente:
 * ainda entra no sistema, mas a mensalidade venceu e não foi paga.
 */
export function ehAdimplente(situacao: SituacaoPagamento): boolean {
  return situacao === "em_dia" || situacao === "liberada";
}

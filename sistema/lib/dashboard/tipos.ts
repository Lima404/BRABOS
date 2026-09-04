import type { CorServico } from "@/lib/agenda/tipos";

/**
 * Domínio do dashboard.
 *
 * O que entra na conta é decidido no banco, em `resumo_dashboard` (migração
 * 0013), e não aqui: serviço conta quando o agendamento está **concluído**,
 * venda conta quando está **confirmada**. Reproduzir essa regra no TypeScript
 * criaria uma segunda verdade, e é assim que o total da tela passa a
 * discordar do relatório.
 */

export type ServicoNoMes = {
  id: string;
  nome: string;
  cor: CorServico;
  quantidade: number;
  totalCentavos: number;
};

export type ProdutoNoMes = {
  nome: string;
  quantidade: number;
  totalCentavos: number;
};

export type MesNoHistorico = {
  /** AAAA-MM */
  mes: string;
  servicoCentavos: number;
  lojaCentavos: number;
  atendimentos: number;
};

export type ResumoDashboard = {
  /** AAAA-MM */
  mes: string;
  servicoCentavos: number;
  lojaCentavos: number;
  /** Agendamentos concluídos no mês. */
  atendimentos: number;
  /** Vendas confirmadas no mês. */
  vendas: number;
  servicos: ServicoNoMes[];
  produtos: ProdutoNoMes[];
  /** Do primeiro movimento até o mês atual, sem buraco. */
  meses: MesNoHistorico[];
};

export const RESUMO_VAZIO: ResumoDashboard = {
  mes: "",
  servicoCentavos: 0,
  lojaCentavos: 0,
  atendimentos: 0,
  vendas: 0,
  servicos: [],
  produtos: [],
  meses: [],
};

export function totalDoMes(m: {
  servicoCentavos: number;
  lojaCentavos: number;
}): number {
  return m.servicoCentavos + m.lojaCentavos;
}

/**
 * O melhor e o pior mês do histórico.
 *
 * Mês zerado fica de fora do "pior": barbearia que abriu em março tem janeiro
 * e fevereiro em zero, e apontá-los como o mês mais fraco seria apontar o
 * período em que ela nem existia. Empate fica com o mais recente, que é o que
 * a dona tem como referência.
 */
export function extremosDoHistorico(meses: MesNoHistorico[]): {
  melhor?: MesNoHistorico;
  pior?: MesNoHistorico;
} {
  const comMovimento = meses.filter((m) => totalDoMes(m) > 0);
  if (comMovimento.length === 0) return {};

  let melhor = comMovimento[0];
  let pior = comMovimento[0];

  for (const m of comMovimento) {
    if (totalDoMes(m) >= totalDoMes(melhor)) melhor = m;
    if (totalDoMes(m) <= totalDoMes(pior)) pior = m;
  }

  return { melhor, pior };
}

/** Média mensal considerando só os meses que tiveram movimento. */
export function mediaMensal(meses: MesNoHistorico[]): number {
  const comMovimento = meses.filter((m) => totalDoMes(m) > 0);
  if (comMovimento.length === 0) return 0;

  const soma = comMovimento.reduce((s, m) => s + totalDoMes(m), 0);
  return Math.round(soma / comMovimento.length);
}

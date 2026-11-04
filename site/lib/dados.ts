/**
 * Os dados que aparecem nos mockups.
 *
 * Saíram do banco de verdade da BARBOS em outubro de 2026 — são os
 * números que o Gabriel vê no dashboard dele. Ficam aqui estáticos de
 * propósito: o site não fala com o Supabase, não tem sessão e não pode
 * vazar o movimento de uma barbearia de cliente.
 */

export type Servico = {
  readonly nome: string;
  readonly cor: string;
  readonly quantidade: number;
  readonly centavos: number;
};

/** Cores de serviço, as mesmas famílias que a agenda usa no sistema. */
export const SERVICOS: readonly Servico[] = [
  { nome: "CABELO + BARBA", cor: "#f2789e", quantidade: 56, centavos: 392000 },
  { nome: "CABELO", cor: "#4ed4a0", quantidade: 76, centavos: 266000 },
  { nome: "BARBA", cor: "#6c8cf5", quantidade: 56, centavos: 168000 },
  { nome: "SOBRANCELHA", cor: "#b18cf0", quantidade: 30, centavos: 75000 },
  { nome: "LAVAGEM", cor: "#4fc3d9", quantidade: 16, centavos: 64000 },
];

export const PRODUTOS: readonly Servico[] = [
  { nome: "COCA", cor: "#6c8cf5", quantidade: 12, centavos: 6000 },
  { nome: "ENERGETICO", cor: "#4ed4a0", quantidade: 8, centavos: 9600 },
  { nome: "POMADA", cor: "#b18cf0", quantidade: 8, centavos: 8000 },
  { nome: "GEL DE BARBA", cor: "#4fc3d9", quantidade: 5, centavos: 4000 },
  { nome: "BISCOITO", cor: "#f2789e", quantidade: 5, centavos: 1500 },
  { nome: "GUARANA", cor: "#a8b0bc", quantidade: 5, centavos: 2500 },
];

export const CAIXA = {
  totalCentavos: 996600,
  servicoCentavos: 965000,
  lojaCentavos: 31600,
  atendimentos: 234,
  vendas: 1,
  itens: 43,
} as const;

/** O gráfico de mês a mês do dashboard. */
export const MESES: readonly { rotulo: string; servico: number; loja: number }[] = [
  { rotulo: "Set/26", servico: 34300, loja: 0 },
  { rotulo: "Out/26", servico: 965000, loja: 31600 },
  { rotulo: "Nov/26", servico: 48000, loja: 0 },
];

/**
 * Outubro de 2026 na agenda. 1º de outubro caiu numa quinta-feira, por
 * isso o mês começa na quarta coluna.
 */
export type Agendamento = {
  readonly hora: string;
  readonly cliente: string;
  readonly servico: number;
};

export type Dia = {
  readonly numero: number;
  readonly agendamentos: readonly Agendamento[];
  readonly excedentes?: number;
  readonly folga?: boolean;
};

const a = (hora: string, cliente: string, servico: number): Agendamento => ({
  hora,
  cliente,
  servico,
});

/** Começa no domingo 27/09 e vai até sábado 31/10 — cinco semanas cheias. */
export const OUTUBRO: readonly (Dia | null)[] = [
  { numero: 27, agendamentos: [] },
  { numero: 28, agendamentos: [], folga: true },
  { numero: 29, agendamentos: [] },
  { numero: 30, agendamentos: [] },
  { numero: 1, agendamentos: [a("09:00", "DANIEL SAP", 1), a("14:00", "CAIO", 0), a("16:00", "JOAO FERREIRA", 2)], excedentes: 1 },
  { numero: 2, agendamentos: [a("09:00", "BRUNO SILVA", 0)] },
  { numero: 3, agendamentos: [a("09:00", "BENICIO ALMEIDA", 4), a("10:30", "RAFAEL ROCHA", 1), a("14:00", "FABIO GOMES", 3)], excedentes: 2 },

  { numero: 4, agendamentos: [] },
  { numero: 5, agendamentos: [a("09:00", "WESLEY LOPES", 0), a("19:30", "THIAGO FERREIRA", 2)] },
  { numero: 6, agendamentos: [a("09:00", "BERNARDO ALMEIDA", 1), a("10:30", "PEDRO LIMA", 0)] },
  { numero: 7, agendamentos: [a("09:00", "CAMARO", 3), a("11:00", "THEO CARVALHO", 0)] },
  { numero: 8, agendamentos: [a("14:00", "JOSE TEIXEIRA", 2), a("16:30", "MARCOS NUNES", 1), a("18:00", "MURILO MARTINS", 0)] },
  { numero: 9, agendamentos: [a("16:00", "FABIO SOARES", 3)] },
  { numero: 10, agendamentos: [a("10:30", "WESLEY MOREIRA", 1), a("15:30", "SERGIO MARTINS", 0)] },

  { numero: 11, agendamentos: [] },
  { numero: 12, agendamentos: [a("09:30", "ALEXANDRE ALMEIDA", 3), a("14:30", "EMANUEL ROCHA", 0)] },
  { numero: 13, agendamentos: [a("15:30", "LEVI TEIXEIRA", 1), a("17:00", "BENICIO FERNANDES", 2)] },
  { numero: 14, agendamentos: [a("09:00", "HEITOR NUNES", 0), a("15:30", "RENATO BARBOSA", 3)] },
  { numero: 15, agendamentos: [a("19:00", "JOSE FERNANDES", 0)] },
  { numero: 16, agendamentos: [a("09:30", "FELIPE RODRIGUES", 1), a("14:30", "ALEXANDRE SILVA", 2)] },
  { numero: 17, agendamentos: [a("14:30", "GABRIEL VIEIRA", 1), a("20:00", "GABRIEL VIEIRA", 0)] },

  { numero: 18, agendamentos: [] },
  { numero: 19, agendamentos: [a("09:00", "BENICIO TEIXEIRA", 1), a("10:00", "CAUA SOUZA", 0)] },
  { numero: 20, agendamentos: [a("16:30", "ALEXANDRE MELO", 2), a("20:00", "DANILO NUNES", 0)] },
  { numero: 21, agendamentos: [a("17:30", "MATEUS ALVES", 3)] },
  { numero: 22, agendamentos: [a("11:00", "THIAGO LOPES", 1), a("18:00", "THIAGO DIAS", 0)] },
  { numero: 23, agendamentos: [a("09:00", "THIAGO SILVA", 1), a("10:00", "TIAGO VIEIRA", 0), a("19:00", "THEO CARVALHO", 2)], excedentes: 1 },
  { numero: 24, agendamentos: [a("16:00", "GUSTAVO CORREIA", 1), a("18:00", "CAIO TEIXEIRA", 0), a("19:00", "LORENZO SILVA", 3)] },

  { numero: 25, agendamentos: [] },
  { numero: 26, agendamentos: [a("09:00", "GABRIEL", 2), a("10:00", "WESLEY VIEIRA", 2), a("16:00", "PAULO DIAS", 3)] },
  { numero: 27, agendamentos: [a("11:00", "ANDRE VIEIRA", 0), a("16:00", "HENRIQUE FERREIRA", 1), a("17:30", "LEONARDO ALVES", 2)] },
  { numero: 28, agendamentos: [a("10:30", "EDUARDO LIMA", 0)] },
  { numero: 29, agendamentos: [a("15:00", "CAIO COSTA", 1), a("16:00", "WESLEY BARBOSA", 0)] },
  { numero: 30, agendamentos: [a("14:30", "MIGUEL GOMES", 1), a("16:30", "PAULO NUNES", 0), a("17:30", "RENATO ALMEIDA", 2)], excedentes: 2 },
  { numero: 31, agendamentos: [a("16:30", "GABRIEL RODRIGUES", 1)] },
];

/** O painel da direita, com o dia 26 aberto. */
export const DIA_ABERTO = {
  titulo: "Segunda-feira, 26 de outubro",
  resumo: "3 agendamentos · R$ 85,00",
  cartoes: [
    { hora: "09:00", cliente: "GABRIEL", servico: 2, preco: "R$ 30,00" },
    { hora: "10:00", cliente: "WESLEY VIEIRA", servico: 2, preco: "R$ 30,00" },
    { hora: "16:00", cliente: "PAULO DIAS", servico: 3, preco: "R$ 25,00" },
  ],
} as const;

/** Formata centavos como o sistema formata: R$ 9.966,00. */
export function emReais(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

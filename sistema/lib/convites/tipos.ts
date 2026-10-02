/**
 * Convites de agendamento — links com validade e com limite de uso.
 *
 * O link do apelido (`/agendar/bicos`) continua existindo e continua aberto
 * para sempre: tem QR code impresso apontando para lá. O convite é o link
 * que a barbearia manda para UMA situação — a promoção da semana, as cinco
 * vagas de sábado — e que morre sozinho quando a situação acaba.
 */

/** Um convite como a barbearia o vê. */
export type Convite = {
  id: string;
  /** Oito caracteres sem vogal e sem 0/1/l — ver migração 0033. */
  codigo: string;
  /** ISO. `null` quando não expira. */
  expiraEm: string | null;
  usos: number;
  /** `null` = ilimitado. */
  usosMax: number | null;
  revogado: boolean;
  /** ISO. */
  criadoEm: string;
};

/**
 * Validades oferecidas.
 *
 * Em horas, e não em dias, porque "6 horas" é a opção que resolve o caso do
 * balcão: o cliente ligou pedindo horário, a barbearia manda o link, e ele
 * não serve mais amanhã.
 */
export const VALIDADES = [
  { horas: 6, rotulo: "6 horas" },
  { horas: 12, rotulo: "12 horas" },
  { horas: 24, rotulo: "1 dia" },
  { horas: 24 * 7, rotulo: "7 dias" },
  { horas: 24 * 30, rotulo: "30 dias" },
  { horas: null, rotulo: "Nunca" },
] as const;

export const LIMITES = [
  { usos: null, rotulo: "Ilimitado" },
  { usos: 1, rotulo: "1 uso" },
  { usos: 5, rotulo: "5 usos" },
  { usos: 10, rotulo: "10 usos" },
  { usos: 25, rotulo: "25 usos" },
] as const;

export const HORAS_VALIDAS: readonly (number | null)[] = VALIDADES.map(
  (v) => v.horas,
);
export const LIMITES_VALIDOS: readonly (number | null)[] = LIMITES.map(
  (l) => l.usos,
);

export type EstadoConvite = "valido" | "expirado" | "esgotado" | "revogado";

/**
 * Em que pé está o convite.
 *
 * `agora` entra por parâmetro em vez de sair de `new Date()` aqui dentro:
 * chamada no meio de um render, a data do servidor e a do navegador saem
 * diferentes e o React reclama de hidratação. Quem chama decide o relógio —
 * e na tela isso só acontece depois que ela monta.
 */
export function estadoDoConvite(c: Convite, agora: Date): EstadoConvite {
  if (c.revogado) return "revogado";
  if (c.expiraEm && new Date(c.expiraEm) <= agora) return "expirado";
  if (c.usosMax !== null && c.usos >= c.usosMax) return "esgotado";
  return "valido";
}

/** "Expira em 3 dias", "Expirou", "Não expira". */
export function textoDaValidade(c: Convite, agora: Date): string {
  if (!c.expiraEm) return "Não expira";

  const falta = new Date(c.expiraEm).getTime() - agora.getTime();
  if (falta <= 0) return "Expirou";

  const horas = Math.ceil(falta / 3_600_000);
  if (horas < 24) {
    return `Expira em ${horas} ${horas === 1 ? "hora" : "horas"}`;
  }

  const dias = Math.ceil(horas / 24);
  return `Expira em ${dias} ${dias === 1 ? "dia" : "dias"}`;
}

/** "3 de 5 usos", "2 usos" quando é ilimitado. */
export function textoDosUsos(c: Convite): string {
  if (c.usosMax === null) {
    return `${c.usos} ${c.usos === 1 ? "uso" : "usos"}`;
  }
  return `${c.usos} de ${c.usosMax} usos`;
}

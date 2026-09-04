import type { Agendamento } from "@/lib/agenda/tipos";

/**
 * A regra de "não marcar em cima": uma cadeira, um cliente por vez.
 *
 * A BARREIRA de verdade é a restrição `agendamento_sem_sobreposicao` do banco
 * (migração 0006) — só ela resiste a duas pessoas marcando o mesmo horário no
 * mesmo segundo. O que está aqui é conveniência: avisar enquanto a pessoa
 * ainda está preenchendo, em vez de deixar o banco recusar depois do envio.
 *
 * As duas precisam concordar. Se a regra do banco mudar, muda aqui junto.
 */

export type Periodo = {
  /** AAAA-MM-DD */
  data: string;
  /** HH:MM */
  horario: string;
  duracaoMin: number;
  /** Só conflita com horário do mesmo barbeiro. */
  barbeiroId?: string;
};

/** Minutos desde a meia-noite. `"09:30"` → 570. */
function emMinutos(horario: string): number {
  const [h, m] = horario.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Dois períodos se pisam?
 *
 * Fim é exclusivo — 9h–10h e 10h–11h **não** conflitam. Sem isso, todo
 * horário emendado seria recusado, que é o contrário do que se quer numa
 * barbearia cheia. Mesma regra do `'[)'` da coluna gerada no banco.
 */
export function sobrepoe(a: Periodo, b: Periodo): boolean {
  if (a.data !== b.data) return false;
  // Sem barbeiro ainda (pré-0015): trata como mesma cadeira da loja.
  if (a.barbeiroId || b.barbeiroId) {
    if (a.barbeiroId !== b.barbeiroId) return false;
  }

  const inicioA = emMinutos(a.horario);
  const inicioB = emMinutos(b.horario);

  return inicioA < inicioB + b.duracaoMin && inicioB < inicioA + a.duracaoMin;
}

/**
 * O primeiro agendamento que o horário pedido atropela, ou `undefined`.
 *
 * Cancelado não conta: o horário voltou a ficar livre. "Não compareceu" conta
 * — o cliente furou, mas a cadeira ficou ocupada esperando por ele.
 *
 * `ignorarId` existe para a edição: ao mover um agendamento, ele não pode
 * conflitar consigo mesmo.
 */
export function conflitoCom(
  periodo: Periodo,
  agendamentos: Agendamento[],
  ignorarId?: string,
): Agendamento | undefined {
  return agendamentos.find(
    (a) =>
      a.id !== ignorarId &&
      a.estado !== "cancelado" &&
      sobrepoe(periodo, {
        data: a.data,
        horario: a.horario,
        duracaoMin: a.duracaoMin,
        barbeiroId: a.barbeiroId,
      }),
  );
}

/** Frase pronta para a tela, com o nome de quem já está no horário. */
export function mensagemDeConflito(a: Agendamento): string {
  const fim = emMinutos(a.horario) + a.duracaoMin;
  const hh = String(Math.floor(fim / 60)).padStart(2, "0");
  const mm = String(fim % 60).padStart(2, "0");

  return `${a.clienteNome} já está marcado das ${a.horario} às ${hh}:${mm}.`;
}

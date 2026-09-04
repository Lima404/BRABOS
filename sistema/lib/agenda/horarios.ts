import { conflitoCom } from "@/lib/agenda/conflitos";
import type { ConfiguracaoAgenda, TurnoHorario } from "@/lib/agenda/tipos";
import type { Agendamento } from "@/lib/agenda/tipos";

/**
 * De quanto em quanto tempo um horário pode começar.
 *
 * Os mesmos 15 minutos do `step` do campo de hora e do arraste da faixa. Se
 * mudar num lugar, muda nos três — senão a busca sugere um horário que o
 * campo depois arredonda.
 */
export const PASSO_DO_HORARIO_MIN = 15;

/** "09:30" → 570. */
function emMinutos(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** 570 → "09:30". */
function emHhmm(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Intervalos em que a barbearia atende no dia.
 *
 * Um só quando o expediente é contínuo; dois (manhã/tarde) com turno.
 * Serviço precisa CABER inteiro dentro de um mesmo intervalo — não atravessa
 * o almoço.
 */
export function intervalosDoDia(config: ConfiguracaoAgenda): TurnoHorario[] {
  if (!config.porTurno) {
    return [{ abre: config.abre, fecha: config.fecha }];
  }
  return [config.manha, config.tarde].filter(
    (t) => t.abre && t.fecha && t.fecha > t.abre,
  );
}

/**
 * Buracos entre turnos (ex.: fecha 12:00 → abre 14:00).
 *
 * É o que a linha do tempo pinta como "não agenda" e o que a marcação
 * precisa recusar — o serviço não atravessa o intervalo.
 */
export function lacunasDoDia(config: ConfiguracaoAgenda): TurnoHorario[] {
  const faixas = intervalosDoDia(config);
  const lacunas: TurnoHorario[] = [];
  for (let i = 0; i < faixas.length - 1; i++) {
    const fecha = faixas[i]!.fecha;
    const abre = faixas[i + 1]!.abre;
    if (abre > fecha) lacunas.push({ abre: fecha, fecha: abre });
  }
  return lacunas;
}

/** O atendimento inteiro cabe em algum turno (ou no intervalo único)? */
export function cabeNoExpediente(
  horario: string,
  duracaoMin: number,
  config: ConfiguracaoAgenda,
): boolean {
  const inicio = emMinutos(horario);
  const fim = inicio + duracaoMin;
  return intervalosDoDia(config).some((faixa) => {
    const abre = emMinutos(faixa.abre);
    const fecha = emMinutos(faixa.fecha);
    return inicio >= abre && fim <= fecha;
  });
}

/**
 * Empurra um minuto bruto para o início válido mais próximo em que o
 * serviço ainda termina dentro do mesmo turno.
 */
export function encaixarInicioNoExpediente(
  minutosBrutos: number,
  duracaoMin: number,
  config: ConfiguracaoAgenda,
  passo = PASSO_DO_HORARIO_MIN,
): string | null {
  const alvo = Math.round(minutosBrutos / passo) * passo;
  let melhor: number | null = null;
  let distancia = Infinity;

  for (const faixa of intervalosDoDia(config)) {
    const abre = emMinutos(faixa.abre);
    const ultimo = emMinutos(faixa.fecha) - duracaoMin;
    if (ultimo < abre) continue;

    const snap = Math.round(
      Math.min(Math.max(alvo, abre), ultimo) / passo,
    ) * passo;
    const candidato = Math.min(Math.max(snap, abre), ultimo);
    const d = Math.abs(candidato - alvo);
    if (d < distancia) {
      distancia = d;
      melhor = candidato;
    }
  }

  return melhor === null ? null : emHhmm(melhor);
}

export function mensagemForaDoExpediente(
  config: ConfiguracaoAgenda,
): string {
  const lacunas = lacunasDoDia(config);
  if (lacunas.length > 0) {
    const l = lacunas[0]!;
    return `Esse horário cai no intervalo (${l.abre}–${l.fecha}), quando a barbearia não atende. Escolha manhã ou tarde.`;
  }
  return `Fora do horário de atendimento (${config.abre} às ${config.fecha}).`;
}

/**
 * O primeiro horário do dia em que esse serviço cabe, com esse barbeiro.
 *
 * Existe porque abrir o modal sempre nas 9h é errado quase o dia inteiro: às
 * 15h da tarde, com a manhã cheia, quem marca tinha que corrigir o campo toda
 * vez — e, se esquecesse, levava um "horário ocupado" que ele mesmo causou.
 *
 * A varredura anda de {@link PASSO_DO_HORARIO_MIN} em
 * {@link PASSO_DO_HORARIO_MIN}, e um horário só serve se:
 *   - começa em `abre` ou depois (e, sendo hoje, não no passado);
 *   - TERMINA até `fecha` — sugerir 18:45 para um corte de 1h numa loja que
 *     fecha às 19h é empurrar o problema para o barbeiro;
 *   - não pisa em ninguém, pela mesma `conflitoCom` que o formulário usa.
 *
 * Devolve `null` quando não sobrou nada — dia cheio, ou já passou da hora de
 * fechar. Quem chama decide o que mostrar; deixar isso explícito evita um
 * "09:00" silencioso que parece livre e não está.
 */
export function proximoHorarioLivre({
  data,
  duracaoMin,
  barbeiroId,
  agendamentos,
  configuracao,
  agora = null,
  ignorarId,
}: {
  /** AAAA-MM-DD. */
  data: string;
  duracaoMin: number;
  /** Sem barbeiro não dá para saber a agenda de quem consultar. */
  barbeiroId: string;
  agendamentos: Agendamento[];
  configuracao: ConfiguracaoAgenda;
  /**
   * HH:MM — piso da busca. `null` quando o dia escolhido não é hoje: aí o dia
   * inteiro está em aberto, e a hora do relógio não tem nada a ver.
   */
  agora?: string | null;
  /** Na edição, o próprio agendamento não conta como ocupação. */
  ignorarId?: string;
}): string | null {
  for (const faixa of intervalosDoDia(configuracao)) {
    const abre = emMinutos(faixa.abre);
    const fecha = emMinutos(faixa.fecha);

    // Arredonda para CIMA: às 14:07 o próximo começo possível é 14:15, não
    // 14:00, que já passou.
    const piso =
      agora === null
        ? abre
        : Math.max(
            abre,
            Math.ceil(emMinutos(agora) / PASSO_DO_HORARIO_MIN) *
              PASSO_DO_HORARIO_MIN,
          );

    for (
      let inicio = piso;
      inicio + duracaoMin <= fecha;
      inicio += PASSO_DO_HORARIO_MIN
    ) {
      const livre = !conflitoCom(
        { data, horario: emHhmm(inicio), duracaoMin, barbeiroId },
        agendamentos,
        ignorarId,
      );
      if (livre) return emHhmm(inicio);
    }
  }

  return null;
}

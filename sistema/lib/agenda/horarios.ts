import { conflitoCom } from "@/lib/agenda/conflitos";
import {
  PASSO_PADRAO,
  ehPassoDeHorario,
  type ConfiguracaoAgenda,
  type PassoDeHorario,
  type TurnoHorario,
} from "@/lib/agenda/tipos";
import type { Agendamento } from "@/lib/agenda/tipos";

/**
 * De quanto em quanto tempo um horário pode começar — a GRADE da agenda.
 *
 * Era uma constante de 15 minutos espalhada por três arquivos. Virou escolha
 * da barbearia (migração 0031), e passa a sair sempre daqui: o `step` do
 * campo de hora, o encaixe do arraste na faixa, a busca do próximo horário
 * livre e a recusa do servidor leem esta função. Duas grades diferentes na
 * mesma agenda é o bug em que a busca sugere um horário que o campo depois
 * arredonda — e que o servidor então recusa.
 *
 * Configuração antiga, sem a coluna, cai no padrão de 15: o comportamento de
 * antes continua sendo o de antes.
 */
export function passoDaAgenda(config: ConfiguracaoAgenda): PassoDeHorario {
  return ehPassoDeHorario(config.passoMin) ? config.passoMin : PASSO_PADRAO;
}

/**
 * O horário cai na grade?
 *
 * Medido desde a MEIA-NOITE, não desde a abertura: "de 30 em 30" para uma
 * pessoa quer dizer 09:00 e 09:30, não 08:45 e 09:15 numa loja que abre
 * às 08:45. Quem abre em horário quebrado perde o primeiro encaixe, e a
 * tela de configuração avisa isso ao salvar.
 */
export function noPassoDaAgenda(
  horario: string,
  config: ConfiguracaoAgenda,
): boolean {
  return emMinutos(horario) % passoDaAgenda(config) === 0;
}

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
  passo = passoDaAgenda(config),
): string | null {
  const alvo = Math.round(minutosBrutos / passo) * passo;
  let melhor: number | null = null;
  let distancia = Infinity;

  for (const faixa of intervalosDoDia(config)) {
    // Os dois extremos já nascem NA GRADE, e é isso que garante que o
    // resultado também nasça. Antes o clamp era feito contra `abre` cru:
    // numa loja que abre 08:45 com passo de 30, arrastar o bloco para o
    // começo do dia devolvia 08:45 — fora da grade que a própria tela
    // acabara de prometer, e recusado pelo servidor no Salvar.
    const primeiro = Math.ceil(emMinutos(faixa.abre) / passo) * passo;
    const ultimo =
      Math.floor((emMinutos(faixa.fecha) - duracaoMin) / passo) * passo;
    if (ultimo < primeiro) continue;

    const candidato = Math.min(Math.max(alvo, primeiro), ultimo);
    const d = Math.abs(candidato - alvo);
    if (d < distancia) {
      distancia = d;
      melhor = candidato;
    }
  }

  return melhor === null ? null : emHhmm(melhor);
}

/**
 * Todos os começos possíveis no dia, na ordem — a grade inteira.
 *
 * `duracaoMin` corta o fim: com 1h de serviço numa loja que fecha às 19h, o
 * último começo é 18:00 e não 18:30. Serve para a tela mostrar a grade em
 * vez de descrevê-la: "09:00, 09:30, 10:00…" responde sozinho a pergunta
 * que "de 30 em 30" deixa no ar.
 */
export function horariosDaGrade(
  config: ConfiguracaoAgenda,
  duracaoMin: number,
): string[] {
  const passo = passoDaAgenda(config);
  const lista: string[] = [];

  for (const faixa of intervalosDoDia(config)) {
    const primeiro = Math.ceil(emMinutos(faixa.abre) / passo) * passo;
    const fecha = emMinutos(faixa.fecha);
    for (let m = primeiro; m + duracaoMin <= fecha; m += passo) {
      lista.push(emHhmm(m));
    }
  }

  return lista;
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
 * A grade do dia SEM o que já está ocupado — o que a tela pode oferecer.
 *
 * Separada de {@link horariosDaGrade} de propósito: as duas respondem a
 * perguntas diferentes, e a tela precisa das duas para explicar o que fez.
 * "Não cabe no dia" manda mexer no expediente; "ocupado" manda escolher
 * outro horário. Uma lista só, sem a de cima para comparar, não saberia
 * dizer qual dos dois aconteceu.
 *
 * A conta é por INTERVALO, não por começo: um corte de 1h às 14:30 esbarra
 * em quem está das 14:00 às 15:00, mesmo sem começar na mesma hora. É a
 * mesma `conflitoCom` que o formulário usa ao salvar — e a barreira de
 * verdade continua sendo a trava do banco (migração 0006), porque entre
 * desenhar esta lista e tocar em Agendar alguém pode ter pegado o horário.
 *
 * `agora` corta o que já passou: às 15:14, 15:00 sai da lista porque o
 * horário começou. Vale só para HOJE — quem chama decide isso passando
 * `null` nos outros dias, porque o relógio não tem nada a ver com a
 * terça-feira que vem.
 */
export function horariosLivresDaGrade({
  configuracao,
  duracaoMin,
  data,
  barbeiroId,
  agendamentos,
  ignorarId,
  agora = null,
}: {
  configuracao: ConfiguracaoAgenda;
  duracaoMin: number;
  /** AAAA-MM-DD */
  data: string;
  barbeiroId: string;
  /** Do barbeiro escolhido; cancelado não ocupa (ver `conflitoCom`). */
  agendamentos: Agendamento[];
  /** Na edição, o próprio agendamento não bloqueia o horário dele. */
  ignorarId?: string;
  /**
   * HH:MM — piso do dia. `null` quando a data escolhida NÃO é hoje: ali o
   * dia inteiro está em aberto e a hora do relógio não significa nada.
   */
  agora?: string | null;
}): string[] {
  const piso = agora === null ? null : emMinutos(agora);

  return horariosDaGrade(configuracao, duracaoMin).filter((horario) => {
    if (piso !== null && emMinutos(horario) < piso) return false;

    return !conflitoCom(
      { data, horario, duracaoMin, barbeiroId },
      agendamentos,
      ignorarId,
    );
  });
}

/** O horário já passou? `false` quando a data não é hoje (`agora` nulo). */
export function jaPassou(horario: string, agora: string | null): boolean {
  return agora !== null && emMinutos(horario) < emMinutos(agora);
}

/**
 * O primeiro horário do dia em que esse serviço cabe, com esse barbeiro.
 *
 * Existe porque abrir o modal sempre nas 9h é errado quase o dia inteiro: às
 * 15h da tarde, com a manhã cheia, quem marca tinha que corrigir o campo toda
 * vez — e, se esquecesse, levava um "horário ocupado" que ele mesmo causou.
 *
 * A varredura anda de {@link passoDaAgenda} em {@link passoDaAgenda}, e um
 * horário só serve se:
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

    const passo = passoDaAgenda(configuracao);
    // O primeiro da GRADE dentro do turno, não a abertura crua — senão a
    // sugestão nasceria fora da grade numa loja que abre em hora quebrada.
    const primeiro = Math.ceil(abre / passo) * passo;

    // Arredonda para CIMA: às 14:07, com passo de 15, o próximo começo
    // possível é 14:15 — 14:00 já passou.
    const piso =
      agora === null
        ? primeiro
        : Math.max(primeiro, Math.ceil(emMinutos(agora) / passo) * passo);

    for (let inicio = piso; inicio + duracaoMin <= fecha; inicio += passo) {
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

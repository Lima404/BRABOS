/**
 * Domínio da agenda.
 *
 * O serviço dá a cor do evento no calendário e a legenda acima dele. O estado
 * (confirmado, faltou…) é outra dimensão, mostrada no painel do dia — cor não
 * carrega as duas coisas ao mesmo tempo sem virar sopa.
 *
 * Desde a migração 0003 os serviços vêm do banco (tabela `servicos`), não de
 * uma constante daqui: o dono cadastra os dele. O que continua no código é a
 * PALETA — os seis nomes de cor com par claro/escuro medido.
 */

/** Nomes da paleta categórica. Cada um tem par texto/fundo nos dois temas. */
export type CorServico =
  | "azul"
  | "verde"
  | "violeta"
  | "ciano"
  | "rosa"
  | "grafite";

/** Ordem de oferta no seletor de cor do cadastro de serviço. */
export const CORES_SERVICO: CorServico[] = [
  "azul",
  "verde",
  "violeta",
  "ciano",
  "rosa",
  "grafite",
];

/** Cor nunca é escolhida só pela amostra: o nome aparece junto. */
export const NOME_DA_COR: Record<CorServico, string> = {
  azul: "Azul",
  verde: "Verde",
  violeta: "Violeta",
  ciano: "Ciano",
  rosa: "Rosa",
  grafite: "Grafite",
};

export function ehCorServico(valor: string): valor is CorServico {
  return (CORES_SERVICO as string[]).includes(valor);
}

/** Classes Tailwind por cor. Mapa explícito: o Tailwind não lê nome montado em runtime. */
export const CLASSES_SERVICO: Record<
  CorServico,
  { texto: string; fundo: string; pontoBg: string; borda: string }
> = {
  azul: {
    texto: "text-serv-azul",
    fundo: "bg-serv-azul-fundo",
    pontoBg: "bg-serv-azul",
    borda: "border-serv-azul",
  },
  verde: {
    texto: "text-serv-verde",
    fundo: "bg-serv-verde-fundo",
    pontoBg: "bg-serv-verde",
    borda: "border-serv-verde",
  },
  violeta: {
    texto: "text-serv-violeta",
    fundo: "bg-serv-violeta-fundo",
    pontoBg: "bg-serv-violeta",
    borda: "border-serv-violeta",
  },
  ciano: {
    texto: "text-serv-ciano",
    fundo: "bg-serv-ciano-fundo",
    pontoBg: "bg-serv-ciano",
    borda: "border-serv-ciano",
  },
  rosa: {
    texto: "text-serv-rosa",
    fundo: "bg-serv-rosa-fundo",
    pontoBg: "bg-serv-rosa",
    borda: "border-serv-rosa",
  },
  grafite: {
    texto: "text-serv-grafite",
    fundo: "bg-serv-grafite-fundo",
    pontoBg: "bg-serv-grafite",
    borda: "border-serv-grafite",
  },
};

/** Limites do campo de duração — os mesmos do CHECK da tabela `servicos`. */
export const DURACAO_MIN = 5;
export const DURACAO_MAX = 480;

/** O que o agendamento precisa saber do serviço para se desenhar. */
export type ServicoResumo = {
  id: string;
  nome: string;
  cor: CorServico;
  /** O "intervalo": quanto tempo de cadeira o serviço ocupa. */
  duracaoMin: number;
};

export type Servico = ServicoResumo & {
  /** Em centavos. Dinheiro nunca em float. */
  precoCentavos: number;
  ativo: boolean;
  ordem: number;
};

// ============================================================
// Configuração da agenda
// ============================================================

/** 0 = domingo … 6 = sábado. Mesma numeração do banco, do JS e do FullCalendar. */
export const DIAS_SEMANA = [
  { numero: 0, curto: "Dom", nome: "Domingo" },
  { numero: 1, curto: "Seg", nome: "Segunda-feira" },
  { numero: 2, curto: "Ter", nome: "Terça-feira" },
  { numero: 3, curto: "Qua", nome: "Quarta-feira" },
  { numero: 4, curto: "Qui", nome: "Quinta-feira" },
  { numero: 5, curto: "Sex", nome: "Sexta-feira" },
  { numero: 6, curto: "Sáb", nome: "Sábado" },
] as const;

export type ConfiguracaoAgenda = {
  /** Dias em que a barbearia atende. */
  diasAtendimento: number[];
  /**
   * Envelope do dia (HH:MM): com turno desligado = o único intervalo;
   * com turno ligado = abre da manhã → fecha da tarde.
   */
  abre: string;
  fecha: string;
  /** Se true, o expediente é manhã / tarde. */
  porTurno: boolean;
  manha: TurnoHorario;
  tarde: TurnoHorario;
};

/** Um turno: abertura e fechamento. */
export type TurnoHorario = {
  abre: string;
  fecha: string;
};

export const TURNOS_PADRAO = {
  manha: { abre: "09:00", fecha: "12:00" } satisfies TurnoHorario,
  tarde: { abre: "14:00", fecha: "18:00" } satisfies TurnoHorario,
} as const;

/** Usado quando a barbearia ainda não tem linha de configuração. */
export const CONFIGURACAO_PADRAO: ConfiguracaoAgenda = {
  diasAtendimento: [1, 2, 3, 4, 5, 6],
  abre: "09:00",
  fecha: "19:00",
  porTurno: false,
  manha: { ...TURNOS_PADRAO.manha },
  tarde: { ...TURNOS_PADRAO.tarde },
};

/**
 * Um dia avulso em que a barbearia não abre — feriado, viagem, casamento.
 *
 * É a EXCEÇÃO, e por isso vive fora de `diasAtendimento`: desmarcar segunda
 * pra fechar num feriado fecharia todas as segundas do ano.
 *
 * Folga **não cancela ninguém**. Ela fecha o dia para horário NOVO; quem já
 * estava marcado continua na agenda, e avisar é da dona — apagar agendamento
 * por tabela seria decidir no lugar dela.
 */
export type Folga = {
  /** AAAA-MM-DD */
  data: string;
};

/** Conjunto de datas para consulta rápida — `folgas.has("2026-09-07")`. */
export function datasDeFolga(folgas: Folga[]): Set<string> {
  return new Set(folgas.map((f) => f.data));
}

// ============================================================
// Agendamento
// ============================================================

export type EstadoAgendamento =
  | "agendado"
  | "confirmado"
  | "atendendo"
  | "concluido"
  | "faltou"
  | "cancelado";

/**
 * `alerta: true` marca os estados que geram prejuízo — ganham ícone além da
 * cor. Estado nunca é comunicado só por cor.
 */
export const ESTADOS: Record<
  EstadoAgendamento,
  { rotulo: string; alerta: boolean; classe: string }
> = {
  agendado: {
    rotulo: "Agendado",
    alerta: false,
    classe: "bg-agendado-fundo text-agendado",
  },
  confirmado: {
    rotulo: "Confirmado",
    alerta: false,
    classe: "bg-confirmado-fundo text-confirmado",
  },
  atendendo: {
    rotulo: "Em atendimento",
    alerta: false,
    classe: "bg-atendendo-fundo text-atendendo",
  },
  concluido: {
    rotulo: "Concluído",
    alerta: false,
    classe: "bg-concluido-fundo text-concluido",
  },
  faltou: {
    rotulo: "Não compareceu",
    alerta: true,
    classe: "bg-faltou-fundo text-faltou",
  },
  cancelado: {
    rotulo: "Cancelado",
    alerta: true,
    classe: "bg-cancelado-fundo text-cancelado line-through",
  },
};

export type Agendamento = {
  id: string;
  clienteNome: string;
  /** Resolvido no repositório, junto com a leitura. */
  servico: ServicoResumo;
  /** Quem atende. Ausente em linha antiga sem migração 0015. */
  barbeiroId?: string;
  /** AAAA-MM-DD, hora local da barbearia. */
  data: string;
  /** HH:MM, hora local da barbearia. */
  horario: string;
  estado: EstadoAgendamento;
  /** Preço congelado no dia do agendamento — reajuste não reescreve história. */
  precoCentavos: number;
  /**
   * Duração congelada no dia do agendamento, em minutos.
   *
   * Vem daqui e NÃO de `servico.duracaoMin`: mudar "Cabelo" de 30 para 60
   * minutos faria todo horário passado esticar na tela e inventar conflitos.
   * É a mesma regra do preço.
   */
  duracaoMin: number;
  observacao?: string;
};

// ============================================================
// Comanda
// ============================================================

/**
 * Uma linha de produto da comanda.
 *
 * Vem de `itens_venda`, onde nome e preço foram congelados na hora da compra.
 * Por isso a comanda de um atendimento de ontem continua batendo mesmo depois
 * de o refrigerante subir de preço — mesma regra do serviço.
 *
 * Uma linha por lançamento, sem juntar iguais: dois refrigerantes pedidos em
 * momentos diferentes aparecem em duas linhas. É como a comanda de papel
 * funciona (cada item é escrito quando é consumido), e é o que permite editar
 * uma linha sem adivinhar qual das compras o barbeiro quis mexer.
 */
export type ItemDaComanda = {
  /** `itens_venda.id` — é por ele que a edição do consumo identifica a linha. */
  id: string;
  nome: string;
  quantidade: number;
  /** Unitário, em centavos. */
  precoCentavos: number;
};

/**
 * Uma alteração pedida no consumo, no formato que a RPC `ajustar_comanda`
 * (migração 0011) consome.
 *
 * `itemId` = linha que já existe; `quantidade: 0` remove.
 * `produtoId` = linha nova, lançada agora.
 */
export type MudancaDeConsumo =
  | { itemId: string; quantidade: number }
  | { produtoId: string; quantidade: number };

/**
 * O que o cliente deve ao sair da cadeira: o serviço mais o que ele consumiu.
 *
 * A conta mora aqui, e não dentro do componente, porque o dashboard vai
 * precisar da MESMA soma. Duas somas em lugares diferentes é como o total da
 * tela e o do relatório passam a discordar sem ninguém perceber.
 */
export function totalDaComanda(
  servicoCentavos: number,
  itens: ItemDaComanda[],
): { produtosCentavos: number; totalCentavos: number } {
  const produtosCentavos = itens.reduce(
    (soma, i) => soma + i.precoCentavos * i.quantidade,
    0,
  );
  return {
    produtosCentavos,
    totalCentavos: servicoCentavos + produtosCentavos,
  };
}

/** Instante local do agendamento — o que o FullCalendar consome. */
export function inicioLocal(a: Agendamento): string {
  return `${a.data}T${a.horario}:00`;
}

export function fimLocal(a: Agendamento): string {
  const inicio = new Date(inicioLocal(a));
  const fim = new Date(inicio.getTime() + a.duracaoMin * 60_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${fim.getFullYear()}-${p(fim.getMonth() + 1)}-${p(fim.getDate())}T${p(fim.getHours())}:${p(fim.getMinutes())}:00`;
}

/**
 * Filtro do dashboard — estado da UI e intervalo enviado à RPC.
 */

export type SecaoFiltro =
  | "todos"
  | "periodo"
  | "servicos"
  | "barbeiros"
  | "loja";

export type PeriodoFiltro = "dia" | "semana" | "mes" | "ano" | "intervalo";

export type FiltroDashboard = {
  periodo: PeriodoFiltro;
  /** AAAA-MM-DD — usado em dia e intervalo. */
  dataInicio: string;
  dataFim: string;
  /** AAAA-Www — modo semana (input type=week). */
  semana: string;
  /** AAAA-MM — modo mês. */
  mes: string;
  /** AAAA — modo ano. */
  ano: string;
  servicoIds: string[];
  barbeiroIds: string[];
  /** Produtos da vitrine (preço > 0 e unidades >= 1). */
  produtoIds: string[];
  soLoja: boolean;
};

/** O que a API / RPC recebe. `fim` é exclusivo. */
export type IntervaloDashboard = {
  inicio: string;
  fim: string;
  servicoIds: string[];
  barbeiroIds: string[];
  produtoIds: string[];
  soLoja: boolean;
};

export const SECOES_FILTRO: {
  id: SecaoFiltro;
  rotulo: string;
  descricao: string;
}[] = [
  {
    id: "todos",
    rotulo: "Todos",
    descricao: "Todas as informações, sem filtro.",
  },
  {
    id: "periodo",
    rotulo: "Período",
    descricao: "Dia, semana, mês, ano ou intervalo de datas.",
  },
  {
    id: "servicos",
    rotulo: "Serviços",
    descricao: "Rendimento por serviço cadastrado.",
  },
  {
    id: "barbeiros",
    rotulo: "Barbeiros",
    descricao: "Rendimento de cada barbeiro.",
  },
  {
    id: "loja",
    rotulo: "Loja",
    descricao: "Só movimentações da loja.",
  },
];

export function filtroPadrao(mesAtual: string): FiltroDashboard {
  const ano = mesAtual.slice(0, 4);
  return {
    periodo: "mes",
    dataInicio: "",
    dataFim: "",
    semana: "",
    mes: mesAtual,
    ano,
    servicoIds: [],
    barbeiroIds: [],
    produtoIds: [],
    soLoja: false,
  };
}

/** Soma um dia em AAAA-MM-DD (UTC noon pra não atravessar fuso). */
function adicionarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + dias);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dia}`;
}

/** Primeiro dia do mês seguinte a AAAA-MM. */
function proximoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  const d = new Date(ano, m, 1); // mês seguinte (Date usa 0-index; m já é 1-12 → dia 1 do mês m+1-1? )
  // `m` é 1–12. `new Date(ano, m, 1)` = dia 1 do mês seguinte (mês 0-index).
  const y = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${y}-${mm}-${dia}`;
}

/**
 * Converte `AAAA-Www` (ISO) no intervalo [segunda, segunda seguinte).
 */
function intervaloDaSemana(semana: string): { inicio: string; fim: string } | null {
  const bate = /^(\d{4})-W(\d{2})$/.exec(semana);
  if (!bate) return null;
  const ano = Number(bate[1]);
  const num = Number(bate[2]);
  if (num < 1 || num > 53) return null;

  // Segunda da semana 1 ISO: semana que contém 4 de janeiro.
  const jan4 = new Date(Date.UTC(ano, 0, 4));
  const diaSemana = jan4.getUTCDay() || 7; // 1=seg … 7=dom
  const segundaSemana1 = new Date(jan4);
  segundaSemana1.setUTCDate(jan4.getUTCDate() - (diaSemana - 1));

  const inicio = new Date(segundaSemana1);
  inicio.setUTCDate(segundaSemana1.getUTCDate() + (num - 1) * 7);
  const fim = new Date(inicio);
  fim.setUTCDate(inicio.getUTCDate() + 7);

  const fmt = (d: Date) =>
    `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

  return { inicio: fmt(inicio), fim: fmt(fim) };
}

/**
 * Intervalo efetivo do filtro pra mandar à API.
 * `fim` é exclusivo (mesmo contrato da RPC).
 */
export function intervaloDoFiltro(
  f: FiltroDashboard,
  mesAtual: string,
): IntervaloDashboard {
  let inicio: string;
  let fim: string;

  switch (f.periodo) {
    case "dia": {
      const d = f.dataInicio || `${mesAtual}-01`;
      inicio = d;
      fim = adicionarDias(d, 1);
      break;
    }
    case "semana": {
      const sem = f.semana ? intervaloDaSemana(f.semana) : null;
      if (sem) {
        inicio = sem.inicio;
        fim = sem.fim;
      } else {
        inicio = `${mesAtual}-01`;
        fim = proximoMes(mesAtual);
      }
      break;
    }
    case "ano": {
      const y = f.ano && /^\d{4}$/.test(f.ano) ? f.ano : mesAtual.slice(0, 4);
      inicio = `${y}-01-01`;
      fim = `${Number(y) + 1}-01-01`;
      break;
    }
    case "intervalo": {
      const a = f.dataInicio || f.dataFim || `${mesAtual}-01`;
      const b = f.dataFim || f.dataInicio || a;
      inicio = a <= b ? a : b;
      fim = adicionarDias(a <= b ? b : a, 1);
      break;
    }
    case "mes":
    default: {
      const m = f.mes && /^\d{4}-\d{2}$/.test(f.mes) ? f.mes : mesAtual;
      inicio = `${m}-01`;
      fim = proximoMes(m);
      break;
    }
  }

  return {
    inicio,
    fim,
    servicoIds: f.servicoIds,
    barbeiroIds: f.barbeiroIds,
    produtoIds: f.produtoIds,
    soLoja: f.soLoja,
  };
}

/** Chave estável pro React Query. */
export function chaveDoIntervalo(i: IntervaloDashboard): string {
  return [
    i.inicio,
    i.fim,
    i.soLoja ? "1" : "0",
    [...i.servicoIds].sort().join(","),
    [...i.barbeiroIds].sort().join(","),
    [...i.produtoIds].sort().join(","),
  ].join("|");
}

/** Quantos critérios saíram do padrão (pra badge do botão). */
export function contarCriteriosAtivos(
  f: FiltroDashboard,
  mesAtual: string,
): number {
  let n = 0;
  if (f.soLoja) n += 1;
  if (f.servicoIds.length > 0) n += 1;
  if (f.barbeiroIds.length > 0) n += 1;
  if (f.produtoIds.length > 0) n += 1;
  if (
    f.periodo !== "mes" ||
    f.mes !== mesAtual ||
    f.dataInicio ||
    f.dataFim ||
    f.semana
  ) {
    n += 1;
  }
  return n;
}

/** Nome de cada id escolhido, quando a tela já tiver as listas em mãos. */
export type NomesDoFiltro = {
  servicos?: Map<string, string>;
  barbeiros?: Map<string, string>;
  produtos?: Map<string, string>;
};

/**
 * Escreve os escolhidos por NOME, e cai na contagem quando não tem os nomes.
 *
 * "1 serviço" não serve de confirmação: quem acabou de marcar CABELO + BARBA
 * lê "1 serviço", não reconhece a própria escolha, e conclui que o filtro não
 * pegou — já aconteceu. O nome é a única forma de a pessoa conferir sem ter
 * que reabrir o diálogo.
 *
 * Dois nomes no máximo: a frase mora no subtítulo, ao lado do período, e uma
 * lista de seis serviços empurraria os cartões para fora da tela no celular.
 */
function escolhidos(
  ids: string[],
  nomes: Map<string, string> | undefined,
  singular: string,
  plural: string,
): string | null {
  if (ids.length === 0) return null;

  const achados = ids.map((id) => nomes?.get(id)).filter(Boolean) as string[];

  // Sem os nomes (listas ainda carregando, ou id de item apagado): a contagem
  // continua sendo melhor que frase nenhuma.
  if (achados.length !== ids.length) {
    return ids.length === 1 ? `1 ${singular}` : `${ids.length} ${plural}`;
  }

  if (achados.length <= 2) return achados.join(" e ");
  return `${achados[0]}, ${achados[1]} +${achados.length - 2}`;
}

/** Frase curta pro subtítulo do dashboard. */
export function resumoDoFiltro(
  f: FiltroDashboard,
  mesAtual: string,
  nomes?: NomesDoFiltro,
): string | null {
  const partes: string[] = [];

  if (f.soLoja) partes.push("só loja");

  const srv = escolhidos(f.servicoIds, nomes?.servicos, "serviço", "serviços");
  if (srv) partes.push(srv);

  const brb = escolhidos(f.barbeiroIds, nomes?.barbeiros, "barbeiro", "barbeiros");
  if (brb) partes.push(brb);

  const prd = escolhidos(f.produtoIds, nomes?.produtos, "produto", "produtos");
  if (prd) partes.push(prd);

  if (f.periodo === "dia" && f.dataInicio) {
    partes.push(`dia ${f.dataInicio.split("-").reverse().join("/")}`);
  } else if (f.periodo === "semana" && f.semana) {
    partes.push(`semana ${f.semana}`);
  } else if (f.periodo === "ano" && f.ano) {
    partes.push(`ano ${f.ano}`);
  } else if (f.periodo === "intervalo" && (f.dataInicio || f.dataFim)) {
    const a = f.dataInicio
      ? f.dataInicio.split("-").reverse().join("/")
      : "…";
    const b = f.dataFim ? f.dataFim.split("-").reverse().join("/") : "…";
    partes.push(`${a} – ${b}`);
  } else if (f.periodo === "mes" && f.mes && f.mes !== mesAtual) {
    partes.push(`mês ${f.mes}`);
  } else if (f.periodo !== "mes") {
    partes.push(f.periodo);
  }

  return partes.length > 0 ? partes.join(" · ") : null;
}

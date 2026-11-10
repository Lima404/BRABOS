/**
 * Filtro do dashboard — estado da UI e intervalo enviado à RPC.
 */

import { mesPorExtenso } from "@/lib/formato";

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

/**
 * Só a parte de datas do filtro. O Painel Admin usa o mesmo período do
 * dashboard (mesmo seletor, mesma URL, mesmo cálculo de intervalo) sem os
 * serviços, barbeiros e produtos, que são de uma barbearia só.
 */
export type PeriodoDoFiltro = Pick<
  FiltroDashboard,
  "periodo" | "dataInicio" | "dataFim" | "semana" | "mes" | "ano"
>;

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
  return {
    ...intervaloDoPeriodo(f, mesAtual),
    servicoIds: f.servicoIds,
    barbeiroIds: f.barbeiroIds,
    produtoIds: f.produtoIds,
    soLoja: f.soLoja,
  };
}

/** As duas datas do período. `fim` é exclusivo. */
export function intervaloDoPeriodo(
  f: PeriodoDoFiltro,
  mesAtual: string,
): { inicio: string; fim: string } {
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

  return { inicio, fim };
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

// ============================================================
// O FILTRO MORA NA URL
// ============================================================
//
// Antes o recorte vivia num `useState` dentro do dashboard: recarregar a
// página devolvia novembro inteiro, o botão voltar saía da tela em vez de
// desfazer o filtro, e mandar "olha o faturamento do KADU em outubro" para
// o sócio era impossível — o link não carregava escolha nenhuma.
//
// Agora a lista de atributos é a busca da URL. Com isso o endereço vira o
// estado: dá para favoritar, recarregar, compartilhar e voltar.
//
// REGRA DE OURO DESTE ARQUIVO: o que está na URL foi DIGITADO POR ALGUÉM.
// `filtroDaBusca` nunca confia — id que não é uuid, data com formato
// errado e período inventado são descartados e caem no padrão. Isso não é
// zelo exagerado: a página do servidor chama `obterResumoDashboard` com o
// que sair daqui, e `p_servico_ids uuid[]` derruba a consulta inteira ao
// receber qualquer coisa que não seja uuid. A rota `/api/dashboard` já se
// defendia sozinha; o caminho do servidor não tinha essa peneira.

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PADRAO_DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const PADRAO_MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const PADRAO_SEMANA = /^\d{4}-W(0[1-9]|[1-4]\d|5[0-3])$/;
const PADRAO_ANO = /^(20[2-9]\d|2[1-9]\d{2})$/;

const PERIODOS: readonly PeriodoFiltro[] = [
  "dia",
  "semana",
  "mes",
  "ano",
  "intervalo",
];

/**
 * Teto de ids por lista.
 *
 * Ninguém tem 200 serviços, mas qualquer um pode colar 200 uuids na barra
 * de endereço. Sem teto isso vira um `uuid[]` gigante dentro de um
 * `= any(...)` em cinco consultas da `resumo_dashboard` — de graça, só
 * editando a URL. Sessenta cabe folgado na maior barbearia e corta o
 * abuso.
 */
const TETO_DE_IDS = 60;

/** `URLSearchParams` e o `ReadonlyURLSearchParams` do Next servem aqui. */
export type LeitorDeBusca = { get(nome: string): string | null };

function seCasar(bruto: string | null, padrao: RegExp): string | null {
  return bruto && padrao.test(bruto) ? bruto : null;
}

/**
 * Ids separados por vírgula, peneirados.
 *
 * Minúsculas e sem repetição porque o resultado vira chave do React Query:
 * a mesma escolha escrita de dois jeitos daria dois caches e duas idas ao
 * banco para o mesmo número.
 */
export function idsDaBusca(bruto: string | null): string[] {
  if (!bruto) return [];

  const vistos = new Set<string>();
  for (const pedaco of bruto.split(",")) {
    const id = pedaco.trim().toLowerCase();
    if (UUID.test(id)) vistos.add(id);
    if (vistos.size >= TETO_DE_IDS) break;
  }

  return [...vistos];
}

/**
 * A busca da URL vira filtro. Nada aqui pode lançar: endereço torto
 * precisa abrir o dashboard no padrão, nunca numa tela de erro.
 */
export function filtroDaBusca(
  busca: LeitorDeBusca,
  mesAtual: string,
): FiltroDashboard {
  return {
    ...periodoDaBusca(busca, mesAtual),
    servicoIds: idsDaBusca(busca.get("servicos")),
    barbeiroIds: idsDaBusca(busca.get("barbeiros")),
    produtoIds: idsDaBusca(busca.get("produtos")),
    soLoja: busca.get("loja") === "1",
  };
}

/** Só as datas, com a mesma peneira. O Painel Admin lê por aqui. */
export function periodoDaBusca(
  busca: LeitorDeBusca,
  mesAtual: string,
): PeriodoDoFiltro {
  const padrao = filtroPadrao(mesAtual);

  const pedido = busca.get("periodo");
  const periodo = PERIODOS.includes(pedido as PeriodoFiltro)
    ? (pedido as PeriodoFiltro)
    : padrao.periodo;

  const mes = seCasar(busca.get("mes"), PADRAO_MES) ?? padrao.mes;
  const dia = seCasar(busca.get("dia"), PADRAO_DATA) ?? "";
  const de = seCasar(busca.get("de"), PADRAO_DATA) ?? "";
  const ate = seCasar(busca.get("ate"), PADRAO_DATA) ?? "";

  return {
    periodo,
    // `dataInicio` serve a dois períodos, e cada um tem seu parâmetro: `dia`
    // e `de` separados evitam que trocar de modo herde a data do outro.
    dataInicio: periodo === "dia" ? dia : periodo === "intervalo" ? de : "",
    dataFim: periodo === "intervalo" ? ate : "",
    semana: seCasar(busca.get("semana"), PADRAO_SEMANA) ?? "",
    mes,
    ano: seCasar(busca.get("ano"), PADRAO_ANO) ?? mes.slice(0, 4),
  };
}

/**
 * O filtro vira busca da URL — só o que saiu do padrão.
 *
 * Mês atual sem recorte nenhum devolve busca VAZIA, e aí o endereço é
 * `/dashboard` limpo. É de propósito: a URL só carrega o que a pessoa
 * escolheu, e quem olha a barra lê a escolha.
 *
 * Os campos mortos do período escolhido ficam de fora — estar no modo
 * "dia" não guarda o mês que alguém digitou antes. Consequência honesta:
 * escolher setembro, aplicar, trocar para dia e aplicar faz o seletor de
 * mês voltar ao mês corrente quando o diálogo reabrir.
 */
export function filtroParaBusca(
  f: FiltroDashboard,
  mesAtual: string,
): URLSearchParams {
  const busca = periodoParaBusca(f, mesAtual);

  if (f.servicoIds.length > 0) busca.set("servicos", f.servicoIds.join(","));
  if (f.barbeiroIds.length > 0) busca.set("barbeiros", f.barbeiroIds.join(","));
  if (f.produtoIds.length > 0) busca.set("produtos", f.produtoIds.join(","));
  if (f.soLoja) busca.set("loja", "1");

  return busca;
}

/** Só as datas, e só o que saiu do padrão. */
export function periodoParaBusca(
  f: PeriodoDoFiltro,
  mesAtual: string,
): URLSearchParams {
  const busca = new URLSearchParams();

  if (f.periodo !== "mes") busca.set("periodo", f.periodo);

  switch (f.periodo) {
    case "dia":
      if (f.dataInicio) busca.set("dia", f.dataInicio);
      break;
    case "semana":
      if (f.semana) busca.set("semana", f.semana);
      break;
    case "ano":
      if (f.ano && f.ano !== mesAtual.slice(0, 4)) busca.set("ano", f.ano);
      break;
    case "intervalo":
      if (f.dataInicio) busca.set("de", f.dataInicio);
      if (f.dataFim) busca.set("ate", f.dataFim);
      break;
    default:
      if (f.mes && f.mes !== mesAtual) busca.set("mes", f.mes);
  }

  return busca;
}

// ============================================================
// A LISTA DE ATRIBUTOS
// ============================================================

export type TipoDeAtributo =
  | "periodo"
  | "soLoja"
  | "servico"
  | "barbeiro"
  | "produto";

/** Um item da lista — o que vira ficha clicável no rodapé do diálogo. */
export type AtributoDoFiltro = {
  /** Única na lista: serve de `key` do React e de alvo do remover. */
  chave: string;
  tipo: TipoDeAtributo;
  /** Id do serviço/barbeiro/produto. Vazio em período e em "só loja". */
  id: string;
  rotulo: string;
  /** De que lista ele saiu — vai para o leitor de tela. */
  grupo: string;
};

function porExtensoCurto(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * `null` quando o período é o padrão (mês corrente).
 *
 * Ficha que está sempre lá e cujo botão de tirar não muda nada visível
 * ensina a pessoa que as fichas não fazem nada. O período só vira ficha
 * quando alguém o mexeu — e aí tirá-la devolve ao mês corrente, que é uma
 * mudança de verdade.
 */
export function rotuloDoPeriodo(
  f: PeriodoDoFiltro,
  mesAtual: string,
): string | null {
  switch (f.periodo) {
    case "dia":
      return f.dataInicio ? `Dia ${porExtensoCurto(f.dataInicio)}` : "Dia";
    case "semana":
      return f.semana
        ? `Semana ${f.semana.slice(6)}/${f.semana.slice(0, 4)}`
        : "Semana";
    case "ano":
      return `Ano ${f.ano || mesAtual.slice(0, 4)}`;
    case "intervalo": {
      if (!f.dataInicio && !f.dataFim) return "Início e fim";
      const a = f.dataInicio ? porExtensoCurto(f.dataInicio) : "…";
      const b = f.dataFim ? porExtensoCurto(f.dataFim) : "…";
      return `${a} – ${b}`;
    }
    default:
      return f.mes && f.mes !== mesAtual ? mesPorExtenso(f.mes) : null;
  }
}

/**
 * O filtro inteiro como lista de fichas, na ordem em que se lê.
 *
 * Sem o nome em mãos a ficha sai com a palavra do grupo ("Serviço"). As
 * listas chegam do cache do React Query em milissegundos, então isso é o
 * primeiro quadro, não o estado normal — e uma ficha a menos piscando
 * seria pior que uma ficha genérica virando o nome certo.
 */
export function atributosDoFiltro(
  f: FiltroDashboard,
  mesAtual: string,
  nomes?: NomesDoFiltro,
): AtributoDoFiltro[] {
  const lista: AtributoDoFiltro[] = [];

  const periodo = rotuloDoPeriodo(f, mesAtual);
  if (periodo) {
    lista.push({
      chave: "periodo",
      tipo: "periodo",
      id: "",
      rotulo: periodo,
      grupo: "Período",
    });
  }

  if (f.soLoja) {
    lista.push({
      chave: "loja",
      tipo: "soLoja",
      id: "",
      rotulo: "Só loja",
      grupo: "Loja",
    });
  }

  const grupos = [
    {
      tipo: "servico" as const,
      grupo: "Serviço",
      ids: f.servicoIds,
      nomes: nomes?.servicos,
    },
    {
      tipo: "barbeiro" as const,
      grupo: "Barbeiro",
      ids: f.barbeiroIds,
      nomes: nomes?.barbeiros,
    },
    {
      tipo: "produto" as const,
      grupo: "Produto",
      ids: f.produtoIds,
      nomes: nomes?.produtos,
    },
  ];

  for (const g of grupos) {
    for (const id of g.ids) {
      lista.push({
        chave: `${g.tipo}:${id}`,
        tipo: g.tipo,
        id,
        rotulo: g.nomes?.get(id) ?? g.grupo,
        grupo: g.grupo,
      });
    }
  }

  return lista;
}

/** Tira uma ficha do filtro. O período volta ao padrão em vez de sumir. */
export function removerAtributo(
  f: FiltroDashboard,
  atributo: AtributoDoFiltro,
  mesAtual: string,
): FiltroDashboard {
  switch (atributo.tipo) {
    case "periodo": {
      const p = filtroPadrao(mesAtual);
      return {
        ...f,
        periodo: p.periodo,
        mes: p.mes,
        ano: p.ano,
        semana: p.semana,
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
      };
    }
    case "soLoja":
      return { ...f, soLoja: false };
    case "servico":
      return {
        ...f,
        servicoIds: f.servicoIds.filter((x) => x !== atributo.id),
      };
    case "barbeiro":
      return {
        ...f,
        barbeiroIds: f.barbeiroIds.filter((x) => x !== atributo.id),
      };
    case "produto":
      return {
        ...f,
        produtoIds: f.produtoIds.filter((x) => x !== atributo.id),
      };
  }
}

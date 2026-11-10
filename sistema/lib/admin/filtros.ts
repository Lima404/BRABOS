/**
 * O filtro da tela Movimento do Painel Admin.
 *
 * É o filtro do dashboard com outras três perguntas: o PERÍODO é o mesmo
 * (mesmo seletor, mesmos parâmetros na URL, mesmo cálculo de intervalo, lidos
 * de `lib/dashboard/filtros.ts`), e no lugar de serviço/barbeiro/produto, que
 * são de uma barbearia só, entram QUAIS barbearias e SE PAGARAM.
 *
 * Mora na URL pelos mesmos motivos do dashboard (recarregar, voltar,
 * favoritar, mandar o link). E a URL continua não sendo confiável: tudo
 * passa pelas peneiras de lá.
 */

import {
  filtroPadrao,
  idsDaBusca,
  periodoDaBusca,
  periodoParaBusca,
  rotuloDoPeriodo,
  type LeitorDeBusca,
  type PeriodoDoFiltro,
} from "@/lib/dashboard/filtros";
import {
  ehAdimplente,
  type BarbeariaNoPainel,
  type MovimentoDaBarbearia,
} from "@/lib/admin/tipos";

export type PagamentoDoFiltro = "todas" | "adimplentes" | "inadimplentes";

export type FiltroAdmin = PeriodoDoFiltro & {
  barbeariaIds: string[];
  pagamento: PagamentoDoFiltro;
};

export const ROTULO_DO_PAGAMENTO: Record<
  Exclude<PagamentoDoFiltro, "todas">,
  string
> = {
  adimplentes: "Adimplentes",
  inadimplentes: "Inadimplentes",
};

export function filtroAdminPadrao(mesAtual: string): FiltroAdmin {
  const { periodo, dataInicio, dataFim, semana, mes, ano } =
    filtroPadrao(mesAtual);
  return {
    periodo,
    dataInicio,
    dataFim,
    semana,
    mes,
    ano,
    barbeariaIds: [],
    pagamento: "todas",
  };
}

export function filtroAdminDaBusca(
  busca: LeitorDeBusca,
  mesAtual: string,
): FiltroAdmin {
  const pagamento = busca.get("pagamento");
  return {
    ...periodoDaBusca(busca, mesAtual),
    barbeariaIds: idsDaBusca(busca.get("barbearias")),
    pagamento:
      pagamento === "adimplentes" || pagamento === "inadimplentes"
        ? pagamento
        : "todas",
  };
}

export function filtroAdminParaBusca(
  f: FiltroAdmin,
  mesAtual: string,
): URLSearchParams {
  const busca = periodoParaBusca(f, mesAtual);
  if (f.barbeariaIds.length > 0) {
    busca.set("barbearias", f.barbeariaIds.join(","));
  }
  if (f.pagamento !== "todas") busca.set("pagamento", f.pagamento);
  return busca;
}

/** Uma ficha do rodapé do diálogo (mesma `ListaDeAtributos` do dashboard). */
export type AtributoAdmin = {
  chave: string;
  tipo: "periodo" | "pagamento" | "barbearia";
  id: string;
  rotulo: string;
  grupo: string;
};

export function atributosDoFiltroAdmin(
  f: FiltroAdmin,
  mesAtual: string,
  nomes?: Map<string, string>,
): AtributoAdmin[] {
  const lista: AtributoAdmin[] = [];

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

  if (f.pagamento !== "todas") {
    lista.push({
      chave: "pagamento",
      tipo: "pagamento",
      id: "",
      rotulo: ROTULO_DO_PAGAMENTO[f.pagamento],
      grupo: "Pagamento",
    });
  }

  for (const id of f.barbeariaIds) {
    lista.push({
      chave: `barbearia:${id}`,
      tipo: "barbearia",
      id,
      rotulo: nomes?.get(id) ?? "Barbearia",
      grupo: "Barbearia",
    });
  }

  return lista;
}

export function removerAtributoAdmin(
  f: FiltroAdmin,
  atributo: AtributoAdmin,
  mesAtual: string,
): FiltroAdmin {
  switch (atributo.tipo) {
    case "periodo": {
      const { barbeariaIds, pagamento } = f;
      return { ...filtroAdminPadrao(mesAtual), barbeariaIds, pagamento };
    }
    case "pagamento":
      return { ...f, pagamento: "todas" };
    case "barbearia":
      return {
        ...f,
        barbeariaIds: f.barbeariaIds.filter((x) => x !== atributo.id),
      };
  }
}

/** Uma linha da tabela: a barbearia e as somas dela no período. */
export type LinhaDoMovimento = MovimentoDaBarbearia & {
  barbearia: BarbeariaNoPainel;
  totalCentavos: number;
};

const ZERADO: Omit<MovimentoDaBarbearia, "barbeariaId"> = {
  agendamentos: 0,
  atendimentos: 0,
  servicoCentavos: 0,
  vendas: 0,
  lojaCentavos: 0,
};

/**
 * Junta a lista de barbearias com as somas e aplica as escolhas.
 *
 * Isto não reescreve regra de caixa: as somas chegam prontas, por
 * barbearia, e aqui só se escolhe QUAIS linhas mostrar e se soma linha com
 * linha. Barbearia sem movimento entra zerada — parada é informação.
 *
 * Do maior total para o menor; empate pelo nome, para a ordem não pular a
 * cada recarga.
 */
export function linhasDoMovimento(
  barbearias: BarbeariaNoPainel[],
  movimento: MovimentoDaBarbearia[],
  f: FiltroAdmin,
): LinhaDoMovimento[] {
  const porId = new Map(movimento.map((m) => [m.barbeariaId, m]));
  const escolhidas = new Set(f.barbeariaIds);

  return barbearias
    .filter((b) => escolhidas.size === 0 || escolhidas.has(b.id))
    .filter((b) =>
      f.pagamento === "todas"
        ? true
        : f.pagamento === "adimplentes"
          ? ehAdimplente(b.situacao)
          : !ehAdimplente(b.situacao),
    )
    .map((b) => {
      const m = porId.get(b.id) ?? { barbeariaId: b.id, ...ZERADO };
      return {
        ...m,
        barbearia: b,
        totalCentavos: m.servicoCentavos + m.lojaCentavos,
      };
    })
    .sort(
      (a, b) =>
        b.totalCentavos - a.totalCentavos ||
        a.barbearia.nome.localeCompare(b.barbearia.nome, "pt-BR"),
    );
}

export function somaDasLinhas(linhas: LinhaDoMovimento[]) {
  return linhas.reduce(
    (s, l) => ({
      agendamentos: s.agendamentos + l.agendamentos,
      atendimentos: s.atendimentos + l.atendimentos,
      servicoCentavos: s.servicoCentavos + l.servicoCentavos,
      vendas: s.vendas + l.vendas,
      lojaCentavos: s.lojaCentavos + l.lojaCentavos,
    }),
    { ...ZERADO },
  );
}

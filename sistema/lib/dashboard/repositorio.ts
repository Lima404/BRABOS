import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { ehCorServico } from "@/lib/agenda/tipos";
import type { IntervaloDashboard } from "@/lib/dashboard/filtros";
import {
  RESUMO_VAZIO,
  type ProdutoNoMes,
  type ResumoDashboard,
  type ServicoNoMes,
  type MesNoHistorico,
} from "@/lib/dashboard/tipos";

/**
 * Camada de dados do dashboard — `resumo_dashboard` (0013 + 0016).
 *
 * O RLS já limita à barbearia logada; nada aqui filtra barbearia na mão.
 */

export async function obterResumoDashboard(
  intervalo: IntervaloDashboard,
): Promise<ResumoDashboard> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase.rpc("resumo_dashboard", {
    p_inicio: intervalo.inicio,
    p_fim: intervalo.fim,
    p_servico_ids:
      intervalo.servicoIds.length > 0 ? intervalo.servicoIds : null,
    p_barbeiro_ids:
      intervalo.barbeiroIds.length > 0 ? intervalo.barbeiroIds : null,
    p_produto_ids:
      intervalo.produtoIds.length > 0 ? intervalo.produtoIds : null,
    p_so_loja: intervalo.soLoja,
  });

  if (error) {
    console.error("[BARBOS] erro ao ler o dashboard:", error.message);

    if (error.message?.includes("resumo_dashboard")) {
      throw new Error(
        "O dashboard filtrado ainda não está ligado. Rode as migrações 0016 e 0017.",
      );
    }

    throw new Error("Não foi possível carregar o dashboard.");
  }

  return normalizar(intervalo.inicio.slice(0, 7), data);
}

/**
 * Compatível com prefetch antigo: só o mês civil atual, sem filtros.
 */
export async function obterResumoDoMes(mes: string): Promise<ResumoDashboard> {
  const [ano, m] = mes.split("-").map(Number);
  const inicio = `${mes}-01`;
  const fimDate = new Date(ano, m, 1);
  const fim = `${fimDate.getFullYear()}-${String(fimDate.getMonth() + 1).padStart(2, "0")}-${String(fimDate.getDate()).padStart(2, "0")}`;

  return obterResumoDashboard({
    inicio,
    fim,
    servicoIds: [],
    barbeiroIds: [],
    produtoIds: [],
    soLoja: false,
  });
}

/**
 * O jsonb vira o tipo do domínio aqui, e não na tela.
 *
 * Tudo passa por `Number(...) || 0`: um campo que faltar por causa de uma
 * versão antiga da função vira zero, e não `NaN` espalhado pelos gráficos —
 * `NaN` no ApexCharts não dá erro, some da fatia e deixa a pizza mentindo.
 */
function normalizar(mes: string, bruto: unknown): ResumoDashboard {
  const r = (bruto ?? {}) as Record<string, unknown>;

  return {
    ...RESUMO_VAZIO,
    mes: typeof r.mes === "string" ? r.mes : mes,
    servicoCentavos: inteiro(r.servicoCentavos),
    lojaCentavos: inteiro(r.lojaCentavos),
    atendimentos: inteiro(r.atendimentos),
    vendas: inteiro(r.vendas),
    servicos: lista(r.servicos).map(servico).filter(temNome),
    produtos: lista(r.produtos).map(produto).filter(temNome),
    meses: lista(r.meses).map(mesDoHistorico).filter((m) => m.mes.length === 7),
  };
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? (valor as Record<string, unknown>[]) : [];
}

function inteiro(valor: unknown): number {
  const n = Number(valor);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function temNome<T extends { nome: string }>(item: T): boolean {
  return item.nome.length > 0;
}

function servico(l: Record<string, unknown>): ServicoNoMes {
  const cor = texto(l.cor);

  return {
    id: texto(l.id),
    nome: texto(l.nome),
    // Cor fora da paleta cai em grafite em vez de quebrar o gráfico.
    cor: ehCorServico(cor) ? cor : "grafite",
    quantidade: inteiro(l.quantidade),
    totalCentavos: inteiro(l.totalCentavos),
  };
}

function produto(l: Record<string, unknown>): ProdutoNoMes {
  return {
    nome: texto(l.nome),
    quantidade: inteiro(l.quantidade),
    totalCentavos: inteiro(l.totalCentavos),
  };
}

function mesDoHistorico(l: Record<string, unknown>): MesNoHistorico {
  return {
    mes: texto(l.mes),
    servicoCentavos: inteiro(l.servicoCentavos),
    lojaCentavos: inteiro(l.lojaCentavos),
    atendimentos: inteiro(l.atendimentos),
  };
}

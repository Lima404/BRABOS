"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import {
  DIA_SEM_LANCAMENTO,
  QUANTIDADE_MAXIMA,
  type LinhaLancada,
  type QuantidadesDoDia,
} from "@/lib/dashboard/registro-manual";

/**
 * Escrita do registro manual do dia (migração 0040).
 *
 * Toda validação é refeita aqui. O que a tela checa é conveniência para
 * quem digita; barreira de verdade é esta função somada aos CHECK do banco
 * — uma ação de servidor é um endereço HTTP público como qualquer outro.
 *
 * Nenhuma consulta filtra barbearia_id: quem isola é o RLS, e a
 * `registrar_dia_manual` confere a dona de cada id antes de gravar.
 */

export type ResultadoRegistro =
  | { ok: true; cortes: number; itens: number }
  | { ok: false; erro: string };

const DATA = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Teto de linhas por chamada.
 *
 * O catálogo de uma barbearia não passa disso nem de longe. O teto existe
 * porque a ação aceita o que mandarem: sem ele, uma chamada com dez mil
 * linhas faria a função no banco varrer dez mil vezes a tabela de produtos
 * com `for update` pendurado.
 */
const TETO_DE_LINHAS = 200;

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

async function protegido(
  operacao: string,
  corpo: () => Promise<ResultadoRegistro>,
): Promise<ResultadoRegistro> {
  try {
    return await corpo();
  } catch (erro) {
    console.error(`[BARBOS] ${operacao} lançou exceção:`, erro);

    const texto = [
      (erro as Error)?.message,
      (erro as { cause?: { message?: string; code?: string } })?.cause?.message,
      (erro as { cause?: { code?: string } })?.cause?.code,
    ]
      .filter(Boolean)
      .join(" ");

    if (FALHA_DE_TRANSPORTE.test(texto)) {
      return {
        ok: false,
        erro: "Não consegui falar com o servidor de dados. Tente de novo em alguns segundos.",
      };
    }

    return {
      ok: false,
      erro: "Algo deu errado ao lançar. Se continuar, recarregue a página.",
    };
  }
}

/** Peneira as linhas que vieram da tela. Id torto ou quantidade fora da
 *  faixa é DESCARTADO, não corrigido: adivinhar o que a pessoa quis dizer
 *  é como se grava um número que ninguém digitou. */
function linhasLimpas(bruto: unknown): { id: string; quantidade: number }[] {
  if (!Array.isArray(bruto)) return [];

  const vistos = new Set<string>();
  const limpas: { id: string; quantidade: number }[] = [];

  for (const linha of bruto.slice(0, TETO_DE_LINHAS)) {
    const id = (linha as LinhaLancada)?.id;
    const quantidade = (linha as LinhaLancada)?.quantidade;

    if (typeof id !== "string" || !UUID.test(id)) continue;
    if (vistos.has(id)) continue;
    if (
      typeof quantidade !== "number" ||
      !Number.isInteger(quantidade) ||
      quantidade < 0 ||
      quantidade > QUANTIDADE_MAXIMA
    ) {
      continue;
    }

    vistos.add(id);
    limpas.push({ id, quantidade });
  }

  return limpas;
}

/**
 * O que já está lançado naquele dia para aquele barbeiro.
 *
 * Ação de servidor e não rota `/api/`: isto só é lido de dentro do modal,
 * e uma rota a mais seria superfície pública sem ninguém do lado de fora
 * para usá-la.
 *
 * Falha devolve dia vazio em vez de lançar. O pior caso é a pessoa ver
 * zeros e redigitar o dia — que a `registrar_dia_manual` trata como
 * correção, não como soma, e portanto não duplica nada.
 */
export async function lerRegistroManual(
  data: string,
  barbeiroId: string | null,
): Promise<QuantidadesDoDia> {
  if (!DATA.test(data)) return DIA_SEM_LANCAMENTO;
  if (barbeiroId !== null && !UUID.test(barbeiroId)) return DIA_SEM_LANCAMENTO;

  try {
    const supabase = await criarClienteServidor();

    const { data: resposta, error } = await supabase.rpc(
      "registro_manual_do_dia",
      { p_data: data, p_barbeiro_id: barbeiroId },
    );

    if (error) {
      console.error(
        "[BARBOS] ler registro manual:",
        error.code ?? "",
        error.message,
      );
      return DIA_SEM_LANCAMENTO;
    }

    const bruto = (resposta ?? {}) as {
      servicos?: Record<string, unknown>;
      produtos?: Record<string, unknown>;
    };

    return {
      servicos: inteiros(bruto.servicos),
      produtos: inteiros(bruto.produtos),
    };
  } catch (erro) {
    console.error("[BARBOS] ler registro manual lançou exceção:", erro);
    return DIA_SEM_LANCAMENTO;
  }
}

function inteiros(bruto: Record<string, unknown> | undefined):
  Record<string, number> {
  const limpo: Record<string, number> = {};
  if (!bruto || typeof bruto !== "object") return limpo;

  for (const [id, valor] of Object.entries(bruto)) {
    const n = Number(valor);
    if (UUID.test(id) && Number.isInteger(n) && n > 0) limpo[id] = n;
  }

  return limpo;
}

/**
 * Grava o dia inteiro de um barbeiro.
 *
 * Uma chamada só, de propósito: a `registrar_dia_manual` aplica tudo ou
 * nada. Mandar uma chamada por linha deixaria o estoque pela metade se a
 * terceira falhasse por falta de unidades — exatamente o motivo da
 * `ajustar_comanda` ter a mesma forma.
 */
export async function salvarRegistroManual(entrada: {
  data: string;
  barbeiroId: string | null;
  servicos: LinhaLancada[];
  produtos: LinhaLancada[];
}): Promise<ResultadoRegistro> {
  return protegido("registrar dia manual", async () => {
    if (!DATA.test(entrada.data)) {
      return { ok: false, erro: "Escolha o dia do lançamento." };
    }

    if (entrada.barbeiroId !== null && !UUID.test(entrada.barbeiroId)) {
      return { ok: false, erro: "Escolha o barbeiro." };
    }

    const servicos = linhasLimpas(entrada.servicos);
    const produtos = linhasLimpas(entrada.produtos);

    if (servicos.length === 0 && produtos.length === 0) {
      return { ok: false, erro: "Lance pelo menos um serviço ou produto." };
    }

    if (servicos.length > 0 && entrada.barbeiroId === null) {
      return { ok: false, erro: "Escolha o barbeiro para lançar serviços." };
    }

    const supabase = await criarClienteServidor();

    const { data, error } = await supabase.rpc("registrar_dia_manual", {
      p_data: entrada.data,
      p_barbeiro_id: entrada.barbeiroId,
      // snake_case aqui porque quem lê é a função no banco, não a tela.
      p_servicos: servicos,
      p_produtos: produtos,
    });

    if (error) {
      console.error(
        "[BARBOS] registrar dia manual:",
        error.code ?? "",
        error.message,
      );

      if (error.message?.includes("registrar_dia_manual")) {
        return {
          ok: false,
          erro: "O registro manual ainda não está ligado no banco. Rode a migração 0040.",
        };
      }

      return { ok: false, erro: "Não consegui lançar. Tente de novo." };
    }

    const resposta = data as {
      ok?: boolean;
      erro?: string;
      cortes?: number;
      itens?: number;
    } | null;

    if (!resposta?.ok) {
      return { ok: false, erro: resposta?.erro ?? "Não consegui lançar." };
    }

    revalidatePath("/dashboard");
    // O estoque muda junto: produto lançado sai da prateleira.
    revalidatePath("/estoque");

    return {
      ok: true,
      cortes: Number(resposta.cortes) || 0,
      itens: Number(resposta.itens) || 0,
    };
  });
}

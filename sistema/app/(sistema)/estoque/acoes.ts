"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { ehTipoProduto, type TipoProduto } from "@/lib/estoque/tipos";
import { nomeParaBanco } from "@/lib/formato";

/**
 * Escrita do estoque.
 *
 * Toda validação é refeita aqui. O que o formulário checa é conveniência;
 * barreira de verdade é esta função somada ao CHECK do banco.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

function traduzir(
  operacao: string,
  erro: { code?: string; message: string },
): Resultado {
  console.error(`[BARBOS] ${operacao}:`, erro.code ?? "", erro.message);

  if (erro.code === "23505") {
    return {
      ok: false,
      erro: "Já existe um produto com esse nome nessa prateleira.",
    };
  }
  if (erro.code === "23514") {
    return {
      ok: false,
      erro: "Algum valor está fora do permitido. Confira e tente de novo.",
    };
  }
  return { ok: false, erro: "Não consegui salvar. Tente de novo." };
}

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

async function protegido(
  operacao: string,
  corpo: () => Promise<Resultado>,
): Promise<Resultado> {
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
      erro: "Algo deu errado ao salvar. Se continuar, recarregue a página.",
    };
  }
}

export type DadosProduto = {
  /** Presente = edição do produto existente. */
  id?: string;
  nome: string;
  unidades: number;
  precoCentavos: number;
  tipo: TipoProduto;
};

function validarProduto(d: DadosProduto): string | null {
  if (d.nome.trim().length === 0) return "Dê um nome ao produto.";
  if (d.nome.trim().length > 80) return "O nome do produto está longo demais.";

  if (!Number.isInteger(d.unidades) || d.unidades < 0) {
    return "Informe quantas unidades (zero ou mais).";
  }
  if (d.unidades > 999_999) {
    return "A quantidade de unidades parece alta demais.";
  }

  if (!ehTipoProduto(d.tipo)) {
    return "Escolha se é Mercearia ou Produtos de Salão.";
  }

  // Mercearia: o form exige preço preenchido. Salão: 0 quando omitido.
  if (!Number.isInteger(d.precoCentavos) || d.precoCentavos < 0) {
    return d.tipo === "mercearia"
      ? "Informe o preço da unidade — na Mercearia ele é obrigatório."
      : "Informe o preço da unidade como 12,90.";
  }
  if (d.precoCentavos > 100_000_00) {
    return "Esse preço parece alto demais. Confira.";
  }

  return null;
}

/** Cadastra ou atualiza — se vier `id`, edita o produto escolhido no combobox. */
export async function salvarProduto(d: DadosProduto): Promise<Resultado> {
  return protegido("salvar produto", async () => {
    const problema = validarProduto(d);
    if (problema) return { ok: false, erro: problema };

    const supabase = await criarClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    const campos = {
      nome: nomeParaBanco(d.nome),
      unidades: d.unidades,
      preco_centavos: d.precoCentavos,
      tipo: d.tipo,
    };

    const { error } = d.id
      ? await supabase.from("produtos").update(campos).eq("id", d.id)
      : await supabase
          .from("produtos")
          .insert({ ...campos, barbearia_id: user.id });

    if (error) return traduzir("salvar produto", error);

    revalidatePath("/estoque");
    revalidatePath("/loja");
    return { ok: true };
  });
}

/** @deprecated Use `salvarProduto`. Mantido pra não quebrar imports antigos. */
export async function criarProduto(d: DadosProduto): Promise<Resultado> {
  return salvarProduto(d);
}

"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { digitosDoTelefone, nomeParaBanco } from "@/lib/formato";

/**
 * Escrita da tela Barbearia: dados da conta e equipe.
 *
 * Validação refeita aqui. O formulário é conveniência; barreira de verdade
 * é esta função + CHECK/RLS do banco.
 */

export type Resultado = { ok: true } | { ok: false; erro: string };

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

function traduzir(
  operacao: string,
  erro: { code?: string; message: string },
): Resultado {
  console.error(`[BARBOS] ${operacao}:`, erro.code ?? "", erro.message);

  if (
    erro.code === "PGRST205" ||
    erro.message?.includes("barbeiros") ||
    erro.message?.includes("schema cache")
  ) {
    return {
      ok: false,
      erro: "A equipe ainda não está ligada no banco. Rode a migração 0014.",
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
      (erro as { cause?: { message?: string } })?.cause?.message,
    ]
      .filter(Boolean)
      .join(" ");

    if (FALHA_DE_TRANSPORTE.test(texto)) {
      return {
        ok: false,
        erro: "Não consegui falar com o servidor. Tente de novo em alguns segundos.",
      };
    }

    return {
      ok: false,
      erro: "Algo deu errado ao salvar. Se continuar, recarregue a página.",
    };
  }
}

function validarNome(nome: string, rotulo: string): string | null {
  // Sanitizado, não só aparado: quem mandou "###" enviou três caracteres e
  // não sobrou nenhum depois da regra do acento e da pontuação.
  const limpo = nomeParaBanco(nome);
  if (limpo.length === 0) return `Dê um nome ${rotulo} com letras ou números.`;
  if (limpo.length > 80) return "O nome está longo demais.";
  return null;
}

function validarTelefone(telefone: string): string | null {
  const digitos = digitosDoTelefone(telefone);
  if (digitos.length < 10 || digitos.length > 11) {
    return "Informe um telefone com DDD (10 ou 11 dígitos).";
  }
  return null;
}

export async function atualizarBarbearia(entrada: {
  nome: string;
  telefone: string;
}): Promise<Resultado> {
  return protegido("atualizar barbearia", async () => {
    const erroNome = validarNome(entrada.nome, "à barbearia");
    if (erroNome) return { ok: false, erro: erroNome };

    const telefone = entrada.telefone.trim();
    // Telefone da conta pode ficar vazio — a dona ainda não cadastrou.
    if (telefone.length > 0) {
      const erroTel = validarTelefone(telefone);
      if (erroTel) return { ok: false, erro: erroTel };
    }

    const supabase = await criarClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Faça login de novo." };

    const { error } = await supabase
      .from("barbearias")
      .update({
        nome: nomeParaBanco(entrada.nome),
        telefone: telefone.length > 0 ? telefone : null,
      })
      .eq("id", user.id);

    if (error) return traduzir("atualizar barbearia", error);

    revalidatePath("/barbearia");
    revalidatePath("/", "layout");
    return { ok: true };
  });
}

export type DadosBarbeiro = {
  /** Presente = edição. */
  id?: string;
  nome: string;
  telefone: string;
};

export async function salvarBarbeiro(
  entrada: DadosBarbeiro,
): Promise<Resultado> {
  return protegido("salvar barbeiro", async () => {
    const erroNome = validarNome(entrada.nome, "ao barbeiro");
    if (erroNome) return { ok: false, erro: erroNome };

    const erroTel = validarTelefone(entrada.telefone);
    if (erroTel) return { ok: false, erro: erroTel };

    const supabase = await criarClienteServidor();
    const payload = {
      nome: nomeParaBanco(entrada.nome),
      telefone: entrada.telefone.trim(),
      ativo: true,
    };

    if (entrada.id) {
      const { error } = await supabase
        .from("barbeiros")
        .update(payload)
        .eq("id", entrada.id)
        .eq("ativo", true);

      if (error) return traduzir("salvar barbeiro", error);
    } else {
      const { error } = await supabase.from("barbeiros").insert(payload);
      if (error) return traduzir("salvar barbeiro", error);
    }

    revalidatePath("/barbearia");
    return { ok: true };
  });
}

export async function desativarBarbeiro(id: string): Promise<Resultado> {
  return protegido("desativar barbeiro", async () => {
    if (!id) return { ok: false, erro: "Barbeiro inválido." };

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("barbeiros")
      .update({ ativo: false })
      .eq("id", id);

    if (error) return traduzir("desativar barbeiro", error);

    revalidatePath("/barbearia");
    return { ok: true };
  });
}

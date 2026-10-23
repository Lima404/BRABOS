"use server";

import { revalidatePath } from "next/cache";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { digitosDoTelefone, nomeParaBanco } from "@/lib/formato";
import { enviarRecado } from "@/lib/notificacoes/servidor";

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


// ============================================================
// Aviso de agendamento no celular (migração 0035)
// ============================================================

export type AssinaturaDeAviso = {
  id: string;
  endpoint: string;
  aparelho: string | null;
  criadoEm: string;
  ultimoEnvioEm: string | null;
  ultimaFalha: string | null;
};

/** Os aparelhos desta barbearia. RLS isola; nenhuma query filtra dono. */
export async function listarAparelhosAvisados(): Promise<AssinaturaDeAviso[]> {
  try {
    const supabase = await criarClienteServidor();
    const { data, error } = await supabase
      .from("assinaturas_push")
      .select("id, endpoint, aparelho, criado_em, ultimo_envio_em, ultima_falha")
      .order("criado_em", { ascending: false });

    if (error) {
      console.error("[BARBOS] aparelhos indisponíveis (migração 0035):", error.message);
      return [];
    }

    return (data ?? []).map((l) => ({
      id: l.id as string,
      endpoint: l.endpoint as string,
      aparelho: (l.aparelho as string | null) ?? null,
      criadoEm: l.criado_em as string,
      ultimoEnvioEm: (l.ultimo_envio_em as string | null) ?? null,
      ultimaFalha: (l.ultima_falha as string | null) ?? null,
    }));
  } catch (erro) {
    console.error("[BARBOS] listar aparelhos lançou exceção:", erro);
    return [];
  }
}

/**
 * Guarda a assinatura deste navegador.
 *
 * `upsert` por `endpoint` e não `insert`: o mesmo navegador assinando de
 * novo recebe o MESMO endereço do serviço de push, e um `insert` seco
 * morreria no índice único. Acontece sempre que a pessoa desliga e religa
 * o aviso.
 *
 * O `barbearia_id` vem do `upsert` também, de propósito: num celular onde
 * duas contas já entraram, o aparelho passa a avisar a conta que ligou por
 * último. Avisar as duas seria mandar o agendamento de uma barbearia para
 * a outra.
 */
export async function salvarAparelhoAvisado(entrada: {
  endpoint: string;
  p256dh: string;
  auth: string;
  aparelho?: string;
}): Promise<Resultado> {
  try {
    if (!entrada.endpoint || !entrada.p256dh || !entrada.auth) {
      return { ok: false, erro: "Assinatura incompleta. Tente ligar de novo." };
    }

    const supabase = await criarClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, erro: "Sessão expirada. Entre de novo." };

    const apelido = nomeParaBanco(entrada.aparelho ?? "").slice(0, 40).trim();

    const { error } = await supabase.from("assinaturas_push").upsert(
      {
        barbearia_id: user.id,
        endpoint: entrada.endpoint,
        p256dh: entrada.p256dh,
        auth: entrada.auth,
        aparelho: apelido.length > 0 ? apelido : null,
        ultima_falha: null,
      },
      { onConflict: "endpoint" },
    );

    if (error) return traduzir("salvar aparelho", error);

    revalidatePath("/barbearia");
    return { ok: true };
  } catch (erro) {
    console.error("[BARBOS] salvar aparelho lançou exceção:", erro);
    if (FALHA_DE_TRANSPORTE.test(String((erro as Error)?.message))) {
      return { ok: false, erro: "Não consegui falar com o servidor." };
    }
    return { ok: false, erro: "Não consegui ligar o aviso. Tente de novo." };
  }
}

/** Desliga um aparelho. O RLS garante que só os próprios saem. */
export async function removerAparelhoAvisado(
  endpoint: string,
): Promise<Resultado> {
  try {
    if (!endpoint) return { ok: false, erro: "Aparelho não informado." };

    const supabase = await criarClienteServidor();
    const { error } = await supabase
      .from("assinaturas_push")
      .delete()
      .eq("endpoint", endpoint);

    if (error) return traduzir("remover aparelho", error);

    revalidatePath("/barbearia");
    return { ok: true };
  } catch (erro) {
    console.error("[BARBOS] remover aparelho lançou exceção:", erro);
    return { ok: false, erro: "Não consegui desligar o aviso. Tente de novo." };
  }
}

/**
 * Manda um aviso de mentira para os aparelhos ligados.
 *
 * Existe porque a alternativa para conferir se o aviso funciona seria pedir
 * a alguém que marcasse um horário de verdade pelo link — e depois apagar.
 * Ligar a notificação sem jeito de testar é o tipo de recurso que a pessoa
 * descobre que não funcionava no dia em que precisava dele.
 *
 * Aqui há sessão, então as assinaturas saem pelo RLS: nada de
 * `security definer`, ao contrário do caminho do agendamento público (ver
 * migração 0035).
 */
export async function enviarAvisoDeTeste(): Promise<Resultado> {
  try {
    const supabase = await criarClienteServidor();

    const { data, error } = await supabase
      .from("assinaturas_push")
      .select("endpoint, p256dh, auth");

    if (error) return traduzir("testar aviso", error);

    const assinaturas = (data ?? []) as {
      endpoint: string;
      p256dh: string;
      auth: string;
    }[];

    if (assinaturas.length === 0) {
      return {
        ok: false,
        erro: "Nenhum aparelho ligado ainda. Ligue o aviso neste celular primeiro.",
      };
    }

    const mortos = await enviarRecado(assinaturas, {
      titulo: "Teste do BARBOS",
      corpo: "Deu certo. É assim que o aviso de agendamento vai chegar.",
      url: "/barbearia",
      tag: `teste-${Date.now()}`,
    });

    for (const endpoint of mortos) {
      await supabase.from("assinaturas_push").delete().eq("endpoint", endpoint);
    }

    if (mortos.length === assinaturas.length) {
      return {
        ok: false,
        erro: "Os aparelhos da lista não existem mais — tirei da lista. Ligue o aviso de novo neste celular.",
      };
    }

    revalidatePath("/barbearia");
    return { ok: true };
  } catch (erro) {
    console.error("[BARBOS] teste de aviso lançou exceção:", erro);
    return { ok: false, erro: "Não consegui mandar o teste. Tente de novo." };
  }
}

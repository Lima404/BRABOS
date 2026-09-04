"use server";

import { redirect } from "next/navigation";

import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoLogin = { erro?: string };

/**
 * Traduz o erro do Supabase pra uma frase que o dono da barbearia entende.
 *
 * Regra: a mensagem diz o que aconteceu e o que fazer. Sem codigo de erro,
 * sem "Auth error", sem pedir desculpa.
 */
function mensagemDeErro(bruta: string): string {
  const m = bruta.toLowerCase();

  if (m.includes("invalid login credentials")) {
    return "E-mail ou senha incorretos. Confira e tente de novo.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de entrar. O link foi enviado no cadastro.";
  }
  if (m.includes("too many requests") || m.includes("rate limit")) {
    return "Muitas tentativas seguidas. Espere um minuto e tente de novo.";
  }
  if (
    m.includes("fetch failed") ||
    m.includes("failed to fetch") ||
    m.includes("network request failed") ||
    m.includes("econnrefused") ||
    m.includes("enotfound") ||
    m.includes("etimedout")
  ) {
    return "Não consegui falar com o servidor de contas. Tente de novo em instantes.";
  }
  return "Não foi possível entrar agora. Tente de novo em instantes.";
}

/** Destino seguro: so caminho interno, nunca URL de fora. */
function destinoSeguro(valor: FormDataEntryValue | null): string {
  const p = typeof valor === "string" ? valor : "";
  return p.startsWith("/") && !p.startsWith("//") ? p : "/agenda";
}

export async function entrar(
  _anterior: EstadoLogin,
  dados: FormData,
): Promise<EstadoLogin> {
  const email = String(dados.get("email") ?? "").trim();
  const senha = String(dados.get("senha") ?? "");

  if (!email || !senha) {
    return { erro: "Preencha e-mail e senha." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  });

  if (error) {
    console.error(
      `[BARBOS] falha no login — ${error.name} ${error.status ?? ""}: ${error.message}`,
    );
    return { erro: mensagemDeErro(error.message) };
  }

  // Fora do try/catch de proposito: redirect() sinaliza por excecao.
  redirect(destinoSeguro(dados.get("proximo")));
}

export async function sair() {
  const supabase = await criarClienteServidor();
  await supabase.auth.signOut();
  redirect("/entrar");
}

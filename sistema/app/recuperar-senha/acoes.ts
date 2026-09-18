"use server";

import { headers } from "next/headers";

import { ROTA_NOVA_SENHA } from "@/lib/auth/recuperacao";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoRecuperacao = {
  erro?: string;
  /** Pedido aceito: a tela troca para "confira sua caixa de entrada". */
  enviadoPara?: string;
};

function mensagemDeErro(bruta: string): string {
  const m = bruta.toLowerCase();

  // O limite de E-MAIL do Supabase é por HORA, não por minuto. Dizer
  // "espere um minuto" faria a pessoa tentar em laço e nunca funcionar.
  if (m.includes("email rate limit")) {
    return "Muitos pedidos em pouco tempo. Tente de novo daqui a uma hora.";
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
  return "Não foi possível enviar o link agora. Tente de novo em instantes.";
}

/** URL pública desta instalação, para o link do e-mail voltar aqui. */
async function origemDaRequisicao(): Promise<string> {
  const h = await headers();
  const origem = h.get("origin");
  if (origem) return origem;

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const protocolo =
    h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocolo}://${host}`;
}

/**
 * Manda o link de recuperação.
 *
 * ============================================================
 * A RESPOSTA É A MESMA EXISTINDO OU NÃO A CONTA
 * ============================================================
 *
 * Nada aqui distingue "mandei o e-mail" de "esse endereço não tem conta". Se
 * distinguisse, este formulário viraria uma máquina de descobrir quem é
 * cliente do BARBOS: bastaria digitar endereços e ler a resposta. E a lista
 * de barbearias cadastradas é exatamente o que um concorrente compraria.
 *
 * Quem é dono do endereço descobre pela caixa de entrada. Mais ninguém.
 * É a mesma regra do cadastro (`app/cadastrar/acoes.ts`).
 *
 * O `resetPasswordForEmail` do Supabase também não devolve erro para e-mail
 * desconhecido — então o silêncio aqui não é um remendo nosso, é o
 * comportamento da fonte, preservado em vez de desfeito.
 */
export async function pedirRecuperacao(
  _anterior: EstadoRecuperacao,
  dados: FormData,
): Promise<EstadoRecuperacao> {
  const email = String(dados.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) return { erro: "Informe o e-mail da conta." };
  if (!email.includes("@") || email.length < 5) {
    return { erro: "Esse e-mail não parece válido. Confira e tente de novo." };
  }

  const supabase = await criarClienteServidor();

  // `proximo` viaja na URL porque o formato PKCE (`?code=`) não carrega o
  // tipo do token: sem ele, `/auth/confirmar` não saberia que esta sessão
  // veio de uma recuperação e mandaria a pessoa para a agenda.
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origemDaRequisicao()}/auth/confirmar?proximo=${encodeURIComponent(
      ROTA_NOVA_SENHA,
    )}`,
  });

  if (error) {
    console.error(
      `[BARBOS] falha ao pedir recuperação — ${error.name} ${error.status ?? ""}: ${error.message}`,
    );
    return { erro: mensagemDeErro(error.message) };
  }

  return { enviadoPara: email };
}

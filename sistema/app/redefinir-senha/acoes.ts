"use server";

import { cookies } from "next/headers";

import {
  COOKIE_RECUPERACAO,
  opcoesDoCookieDeRecuperacao,
} from "@/lib/auth/recuperacao";
import { SENHA_MINIMA } from "@/lib/auth/senha";
import { criarClienteServidor } from "@/lib/supabase/servidor";

export type EstadoNovaSenha = {
  erro?: string;
  /** Senha trocada: a tela troca para a confirmação. */
  pronto?: boolean;
};

function mensagemDeErro(bruta: string): string {
  const m = bruta.toLowerCase();

  if (m.includes("password") && m.includes("short")) {
    return `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.`;
  }
  if (m.includes("weak") || m.includes("pwned")) {
    return "Essa senha é fácil de adivinhar. Escolha outra.";
  }
  // O Supabase recusa repetir a senha atual quando a opção está ligada no
  // painel. Para quem esqueceu a senha isso soa absurdo — a mensagem tem que
  // dizer que ele acertou a antiga, não que errou alguma coisa.
  if (m.includes("should be different") || m.includes("same as the old")) {
    return "Essa já é a sua senha atual. Escolha uma diferente.";
  }
  if (m.includes("session") || m.includes("jwt") || m.includes("token")) {
    return "O link expirou. Peça um novo em “Recuperar acesso”.";
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
  return "Não foi possível trocar a senha agora. Tente de novo em instantes.";
}

/**
 * Grava a senha nova.
 *
 * Confere a marca de procedência ANTES de qualquer coisa: ter sessão não
 * basta para trocar senha sem saber a antiga (ver lib/auth/recuperacao.ts).
 */
export async function redefinirSenha(
  _anterior: EstadoNovaSenha,
  dados: FormData,
): Promise<EstadoNovaSenha> {
  const armazem = await cookies();

  if (!armazem.get(COOKIE_RECUPERACAO)) {
    return {
      erro: "Esta página só abre pelo link do e-mail. Peça um novo em “Recuperar acesso”.",
    };
  }

  const senha = String(dados.get("senha") ?? "");
  const confirmacao = String(dados.get("confirmacao") ?? "");

  if (!senha || !confirmacao) return { erro: "Preencha os dois campos." };
  if (senha.length < SENHA_MINIMA) {
    return { erro: `A senha precisa de pelo menos ${SENHA_MINIMA} caracteres.` };
  }
  // Comparar aqui, no servidor, e não só no navegador: a checagem do
  // navegador é conveniência, não garantia — o formulário pode ser enviado
  // sem ela.
  if (senha !== confirmacao) {
    return { erro: "As duas senhas não são iguais. Digite de novo." };
  }

  const supabase = await criarClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: senha });

  if (error) {
    console.error(
      `[BARBOS] falha ao trocar senha — ${error.name} ${error.status ?? ""}: ${error.message}`,
    );
    return { erro: mensagemDeErro(error.message) };
  }

  // Derruba as OUTRAS sessões. Quem chegou aqui ou esqueceu a senha ou
  // desconfia que ela vazou; nos dois casos, uma sessão aberta em outro
  // aparelho continuaria valendo com a senha antiga já trocada. `others`
  // e não `global`: a sessão desta aba fica de pé, senão a pessoa trocaria
  // a senha e cairia no login no mesmo segundo.
  const { error: erroAoSair } = await supabase.auth.signOut({
    scope: "others",
  });
  if (erroAoSair) {
    // Não é motivo para dizer que falhou: a senha JÁ mudou. Fica no log.
    console.error(
      "[BARBOS] senha trocada, mas não consegui derrubar as outras sessões:",
      erroAoSair.message,
    );
  }

  // A marca cumpriu o papel e some — senão a janela de 15 minutos ficaria
  // aberta para trocar a senha de novo sem novo link.
  armazem.set(COOKIE_RECUPERACAO, "", {
    ...opcoesDoCookieDeRecuperacao,
    maxAge: 0,
  });

  // Confirmação na própria tela, não um redirect para a agenda: quem
  // acabou de trocar uma senha precisa VER que deu certo. Cair direto na
  // agenda deixa a dúvida "será que salvou?", e a dúvida leva a trocar de
  // novo.
  return { pronto: true };
}

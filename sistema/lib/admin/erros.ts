import "server-only";

import { unstable_rethrow } from "next/navigation";

/**
 * A tradução de erro das ações do Painel Admin e das notificações.
 *
 * Mesma regra do resto do sistema: o original vai para o log, a pessoa lê
 * o que houve e o que fazer — sem código de erro.
 */

const FALHA_DE_TRANSPORTE =
  /fetch failed|failed to fetch|network request failed|econnrefused|enotfound|etimedout|unable to verify|self.signed|socket hang up/i;

export function traduzirErro(
  operacao: string,
  erro: { code?: string; message: string },
): string {
  console.error(`[BARBOS] ${operacao}:`, erro.code ?? "", erro.message);

  // Função, tabela, coluna ou ligação que o banco ainda não tem.
  if (
    erro.code === "PGRST200" ||
    erro.code === "PGRST202" ||
    erro.code === "PGRST204" ||
    erro.code === "PGRST205" ||
    erro.code === "42703" ||
    erro.code === "42883" ||
    erro.code === "42P01"
  ) {
    return "Isto ainda não está ligado no banco. Rode as migrações 0044, 0045 e 0046.";
  }
  if (erro.code === "42501") {
    return "Isto é só da conta admin.";
  }
  if (erro.code === "23514") {
    return "Algum campo está vazio ou passou do tamanho. Confira e tente de novo.";
  }
  if (FALHA_DE_TRANSPORTE.test(erro.message ?? "")) {
    return "Não consegui falar com o servidor. Tente de novo em alguns segundos.";
  }
  return "Não deu certo. Tente de novo.";
}

/**
 * Para o `catch`: a exceção vira frase, e a original vai para o log.
 *
 * Antes de tudo, devolve ao Next o que é dele. `cookies()` lança um erro
 * interno de propósito quando a página é montada no build, e é assim que o
 * Next descobre que a tela depende de sessão. Engolido aqui, o build
 * registrava "exceção" em toda tela do painel e a página podia sair
 * montada com a mensagem de erro dentro.
 */
export function traduzirExcecao(operacao: string, erro: unknown): string {
  unstable_rethrow(erro);
  console.error(`[BARBOS] ${operacao} lançou exceção:`, erro);

  const texto = [
    (erro as Error)?.message,
    (erro as { cause?: { message?: string } })?.cause?.message,
  ]
    .filter(Boolean)
    .join(" ");

  if (FALHA_DE_TRANSPORTE.test(texto)) {
    return "Não consegui falar com o servidor. Tente de novo em alguns segundos.";
  }
  return "Algo deu errado. Se continuar, recarregue a página.";
}

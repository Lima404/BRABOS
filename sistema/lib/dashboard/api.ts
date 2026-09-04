import type { IntervaloDashboard } from "@/lib/dashboard/filtros";
import type { ResumoDashboard } from "@/lib/dashboard/tipos";

/** Chamada do navegador. O servidor usa lib/dashboard/repositorio direto. */

/**
 * Mesma defesa da agenda: com a sessão expirada o proxy manda pro login, o
 * fetch segue o redirecionamento e volta 200 com HTML. Sem checar isso o
 * `.json()` estoura e a tela mostra "Unexpected token '<'".
 */
async function comoJson<T>(resposta: Response, oQue: string): Promise<T> {
  if (resposta.status === 401 || resposta.redirected) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  if (!resposta.ok) {
    let detalhe = "";
    try {
      const corpo = (await resposta.json()) as { erro?: string };
      detalhe = corpo.erro ? ` ${corpo.erro}` : "";
    } catch {
      /* ignore */
    }
    throw new Error(`Não foi possível carregar ${oQue}.${detalhe}`);
  }

  if (!resposta.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  return resposta.json() as Promise<T>;
}

export async function buscarResumoDashboard(
  intervalo: IntervaloDashboard,
): Promise<ResumoDashboard> {
  const params = new URLSearchParams({
    inicio: intervalo.inicio,
    fim: intervalo.fim,
  });
  if (intervalo.soLoja) params.set("soLoja", "1");
  if (intervalo.servicoIds.length > 0) {
    params.set("servicos", intervalo.servicoIds.join(","));
  }
  if (intervalo.barbeiroIds.length > 0) {
    params.set("barbeiros", intervalo.barbeiroIds.join(","));
  }
  if (intervalo.produtoIds.length > 0) {
    params.set("produtos", intervalo.produtoIds.join(","));
  }

  const resposta = await fetch(`/api/dashboard?${params}`);
  return comoJson<ResumoDashboard>(resposta, "o dashboard");
}

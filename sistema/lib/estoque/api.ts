import type { Produto } from "@/lib/estoque/tipos";

/**
 * Resposta que deveria ser JSON.
 *
 * Mesma defesa da agenda: sessão expirada pode devolver HTML do login com
 * status 200; sem checar content-type o `.json()` estoura na cara.
 */
async function comoJson<T>(resposta: Response, oQue: string): Promise<T> {
  if (resposta.status === 401 || resposta.redirected) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  if (!resposta.ok) {
    throw new Error(`Não foi possível carregar ${oQue}.`);
  }

  if (!resposta.headers.get("content-type")?.includes("application/json")) {
    throw new Error("Sua sessão expirou. Entre de novo.");
  }

  return resposta.json() as Promise<T>;
}

export async function buscarProdutos(): Promise<Produto[]> {
  const resposta = await fetch("/api/estoque");
  return comoJson<Produto[]>(resposta, "o estoque");
}

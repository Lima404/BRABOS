import type { Barbeiro } from "@/lib/barbearia/tipos";

/**
 * Chamadas do navegador. O servidor usa lib/barbearia/repositorio direto.
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

export async function buscarBarbeiros(): Promise<Barbeiro[]> {
  const resposta = await fetch("/api/barbearia/barbeiros");
  return comoJson<Barbeiro[]>(resposta, "a equipe");
}

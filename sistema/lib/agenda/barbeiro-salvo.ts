/**
 * Barbeiro escolhido na agenda — sobrevive a F5 e a sair da página.
 *
 * Uma conta = uma barbearia neste login. Se o id salvo não existir mais na
 * equipe (barbeiro removido), a agenda cai no primeiro da lista.
 */

const CHAVE = "barbos.agenda.barbeiroId";

export function lerBarbeiroSalvo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CHAVE);
  } catch {
    return null;
  }
}

export function salvarBarbeiroEscolhido(id: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CHAVE, id);
  } catch {
    // Storage cheio ou bloqueado — a sessão continua sem persistir.
  }
}

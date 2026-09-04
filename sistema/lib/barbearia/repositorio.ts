import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import type { Barbeiro } from "@/lib/barbearia/tipos";

/**
 * Equipe ativa da barbearia logada.
 *
 * Lista vazia quando a migração 0014 ainda não rodou — a tela avisa.
 * Falhar a página inteira por causa da equipe esconderia o form de dados.
 */
export async function listarBarbeiros(): Promise<Barbeiro[]> {
  const supabase = await criarClienteServidor();

  const { data, error } = await supabase
    .from("barbeiros")
    .select("id, nome, telefone")
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (error) {
    console.error(
      "[BARBOS] barbeiros indisponíveis (rode a migração 0014):",
      error.message,
    );
    return [];
  }

  return (data ?? []) as Barbeiro[];
}

/** True quando a tabela `barbeiros` responde (migração 0014 aplicada). */
export async function equipeDisponivel(): Promise<boolean> {
  const supabase = await criarClienteServidor();
  const { error } = await supabase
    .from("barbeiros")
    .select("id")
    .limit(1);

  if (!error) return true;

  // PGRST205 = relação não encontrada no schema cache do PostgREST.
  if (
    error.code === "PGRST205" ||
    error.message?.includes("barbeiros") ||
    error.message?.includes("schema cache")
  ) {
    return false;
  }

  // Outro erro (rede, RLS): a tabela existe; deixa a lista tentar.
  return true;
}

import "server-only";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type Barbearia = {
  id: string;
  nome: string;
  telefone?: string;
  /** Apelido público da loja. Endereço: /loja/<slug>. */
  slug: string;
};

export type Sessao = {
  /** Há alguém logado? Não é o mesmo que ter barbearia — ver abaixo. */
  logado: boolean;
  barbearia: Barbearia | null;
};

/**
 * Quem está usando o sistema agora.
 *
 * `logado` e `barbearia` são coisas diferentes de propósito: conta pode
 * existir sem a linha em `barbearias` (migração não rodada, trigger
 * desligado). Quem decide se mostra navegação é `logado`; quem decide se
 * mostra dado é `barbearia`. Juntar os dois esconderia o segundo caso, que é
 * justamente o que precisa de mensagem clara na tela.
 *
 * Uma chamada só a `getUser()` para os dois — o shell roda a cada navegação.
 */
export async function obterSessao(): Promise<Sessao> {
  if (!supabaseConfigurado) return { logado: false, barbearia: null };

  const supabase = await criarClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { logado: false, barbearia: null };

  const { data, error } = await supabase
    .from("barbearias")
    .select("id, nome, telefone, slug")
    .single();

  if (error) {
    console.error("[BARBOS] erro ao ler a barbearia:", error.message);
    return { logado: true, barbearia: null };
  }

  return {
    logado: true,
    barbearia: {
      id: data.id,
      nome: data.nome,
      telefone: data.telefone ?? undefined,
      slug: data.slug,
    },
  };
}

/**
 * A barbearia da conta logada.
 *
 * Uma conta = uma barbearia, entao nao ha o que escolher: o RLS ja devolve
 * exatamente uma linha. Retorna null quando nao ha sessao.
 */
export async function obterBarbearia(): Promise<Barbearia | null> {
  return (await obterSessao()).barbearia;
}

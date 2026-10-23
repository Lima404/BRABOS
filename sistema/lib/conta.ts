import "server-only";

import { cache } from "react";

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
 *
 * ============================================================
 * `cache()` NÃO É OTIMIZAÇÃO SOLTA: SEM ELE SÃO DUAS LEITURAS
 * ============================================================
 *
 * O layout do sistema chama isto para desenhar a barra, e a PÁGINA de
 * dentro chama de novo (direto, ou por `obterBarbearia`). Eram duas
 * execuções inteiras por navegação — dois clientes montados, dois
 * `getUser()`, duas leituras de `barbearias` — para a mesma resposta.
 *
 * Honestidade sobre o ganho: o Next junta sozinho duas requisições GET
 * idênticas dentro do mesmo render, então parte disso já não ia à rede
 * duas vezes. O que `cache()` garante é que NÃO DEPENDE disso — a
 * dedução do Next vale para GET, e some no dia em que uma destas
 * chamadas virar POST (toda RPC do Supabase é POST; ver a medição no
 * AGENTS.md, onde a RPC da tela de agendar ia duas vezes de verdade).
 *
 * `cache()` do React vale por REQUISIÇÃO: a segunda chamada devolve o
 * resultado da primeira, e a requisição seguinte começa do zero. Não é
 * cache entre usuários nem entre navegações — isso seria vazar sessão.
 */
export const obterSessao = cache(async function obterSessao(): Promise<Sessao> {
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
});

/**
 * A barbearia da conta logada.
 *
 * Uma conta = uma barbearia, entao nao ha o que escolher: o RLS ja devolve
 * exatamente uma linha. Retorna null quando nao ha sessao.
 */
export async function obterBarbearia(): Promise<Barbearia | null> {
  return (await obterSessao()).barbearia;
}

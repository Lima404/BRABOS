import "server-only";

import { cache } from "react";
import { isAuthRetryableFetchError, type User } from "@supabase/supabase-js";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

export type Barbearia = {
  id: string;
  nome: string;
  telefone?: string;
  /** Apelido público da loja. Endereço: /loja/<slug>. */
  slug: string;
  /**
   * Abre o Painel Admin (0044). Só a BARBOS. Isto decide o que a TELA
   * mostra; quem barra o dado são as funções `admin_*` do banco.
   */
  admin: boolean;
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

  const user = await usuarioDaSessao(supabase);
  if (!user) return { logado: false, barbearia: null };

  // `*` e não a lista de colunas: sem a 0044 no banco, pedir `admin` pelo
  // nome derrubaria a leitura e, com ela, a navegação de TODAS as contas.
  // Com `*` a coluna que falta vira `undefined`, e `undefined` é "não é
  // admin".
  const { data, error } = await supabase
    .from("barbearias")
    .select("*")
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
      admin: data.admin === true,
    },
  };
});

/**
 * O `getUser()`, sem deixar falha de rede derrubar a tela.
 *
 * ============================================================
 * O MESMO PROBLEMA QUE O `proxy.ts` JÁ TRATAVA
 * ============================================================
 *
 * O proxy embrulha o `getUser()` num try/catch (ver "LAÇO 1" lá). Este
 * aqui não embrulhava — e ele roda no layout do sistema, a cada
 * navegação. Uma falha de rede no instante errado (4G da rua, Supabase
 * oscilando, antivírus no TLS) estourava o layout inteiro, e quem via o
 * resultado era a página de erro padrão do Next.
 *
 * A falha chega de dois jeitos: LANÇANDO (o caso do antivírus) ou
 * DEVOLVENDO `AuthRetryableFetchError` com usuário nulo. Os dois ganham
 * uma segunda tentativa, porque a queda costuma durar um instante. Se a
 * segunda também falhar, a tela abre como "sem sessão" — mesma escolha
 * do proxy: não vaza nada, porque quem isola os dados é o RLS, e
 * recarregar resolve quando a rede volta.
 *
 * Resposta que CHEGOU dizendo "sem usuário" não é repetida: aí a pessoa
 * está deslogada mesmo.
 */
async function usuarioDaSessao(
  supabase: Awaited<ReturnType<typeof criarClienteServidor>>,
): Promise<User | null> {
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (!error || !isAuthRetryableFetchError(error)) return data.user;
      console.error(
        `[BARBOS] getUser não alcançou o Supabase (tentativa ${tentativa}):`,
        error.message,
      );
    } catch (erro) {
      console.error(
        `[BARBOS] getUser lançou (tentativa ${tentativa}):`,
        erro,
      );
    }
  }
  return null;
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

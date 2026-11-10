/**
 * Resposta de uma ação de servidor que LÊ.
 *
 * A ação nunca lança: erro vira `{ ok: false, erro }` com a frase já
 * traduzida. Se ela lançasse, o Next trocaria a mensagem por um texto
 * genérico em produção, e a tela diria "algo deu errado" no lugar de
 * "rode a migração 0044".
 */
export type Consulta<T> = { ok: true; dados: T } | { ok: false; erro: string };

/**
 * Para usar como `queryFn`: devolve os dados ou lança a frase traduzida,
 * que é o que o React Query precisa para cair no estado de erro.
 *
 *   queryFn: () => dadosOuErro(listarBarbeariasDoPainel())
 */
export async function dadosOuErro<T>(consulta: Promise<Consulta<T>>): Promise<T> {
  const resposta = await consulta;
  if (!resposta.ok) throw new Error(resposta.erro);
  return resposta.dados;
}

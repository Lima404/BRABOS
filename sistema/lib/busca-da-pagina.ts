export type BuscaDaPagina = Record<string, string | string[] | undefined>;

/**
 * O que veio na barra de endereço, como `URLSearchParams`.
 *
 * O Next entrega a busca já desmontada num objeto, e o mesmo nome repetido
 * (`?servicos=a&servicos=b`) chega como lista. Juntar com vírgula em vez de
 * ficar com o primeiro é o certo aqui porque é exatamente esse o formato
 * das listas de id — assim um link escrito à mão dos dois jeitos funciona.
 */
export function buscaDaPagina(bruto: BuscaDaPagina): URLSearchParams {
  const busca = new URLSearchParams();

  for (const [nome, valor] of Object.entries(bruto)) {
    if (typeof valor === "string") busca.set(nome, valor);
    else if (Array.isArray(valor) && valor.length > 0) {
      busca.set(nome, valor.join(","));
    }
  }

  return busca;
}

/**
 * Os capítulos do site, na ordem em que aparecem.
 *
 * A página é contada como um filme curto: cada seção é um capítulo de tela
 * cheia, numerado. Esta lista é a única fonte dessa ordem — o trilho lateral,
 * o menu do topo e o rodapé leem daqui, e o `id` é o mesmo que a seção usa
 * no HTML. Mudou a ordem das seções em `app/page.tsx`, muda aqui também.
 */
export type Capitulo = {
  readonly id: string;
  /** O nome curto, que aparece no trilho e no menu. */
  readonly nome: string;
  /** Aparece também no menu do topo, e não só no trilho. */
  readonly noMenu: boolean;
};

export const CAPITULOS: readonly Capitulo[] = [
  { id: "topo", nome: "Início", noMenu: false },
  { id: "ferramentas", nome: "O que faz", noMenu: true },
  { id: "telas", nome: "As telas", noMenu: true },
  { id: "caderno", nome: "Por que trocar", noMenu: true },
  { id: "celular", nome: "No celular", noMenu: true },
  { id: "passos", nome: "Como começa", noMenu: false },
  { id: "impacto", nome: "Impacto", noMenu: false },
  { id: "planos", nome: "Planos", noMenu: true },
  { id: "comecar", nome: "Começar", noMenu: false },
];

/** "02", "03"... — o número do capítulo como aparece na tela. */
export function numeroDo(id: string): string {
  const indice = CAPITULOS.findIndex((capitulo) => capitulo.id === id);
  return String(indice + 1).padStart(2, "0");
}

/**
 * Registro manual do dia — regras puras, compartilhadas pela tela e pela
 * ação de servidor.
 *
 * A barbearia que não usa agenda fecha o dia contando: "o GABRIEL fez 5
 * cabelos, a DAIANNE fez 3, saíram 12 energéticos". Isso vira contagem na
 * `registros_servico_manual` e venda de verdade em `vendas` (migração
 * 0040).
 *
 * CORRIGE, NÃO SOMA. "5 cabelos" quer dizer "foram 5", não "mais 5". Quem
 * reabre o dia para trocar 5 por 6 espera 6, e é assim que a
 * `registrar_dia_manual` grava — mesma forma da `ajustar_comanda`.
 */

/** Teto por linha. O mesmo CHECK existe no banco. */
export const QUANTIDADE_MAXIMA = 999;

/** O que já foi lançado naquele dia, por id. */
export type QuantidadesDoDia = {
  servicos: Record<string, number>;
  produtos: Record<string, number>;
};

export const DIA_SEM_LANCAMENTO: QuantidadesDoDia = {
  servicos: {},
  produtos: {},
};

/** Uma linha do catálogo — serviço ou produto — pronta para a tabela. */
export type ItemDoRegistro = {
  id: string;
  nome: string;
  /** Segunda linha da célula: tipo do produto, duração do serviço. */
  detalhe: string | null;
  precoCentavos: number;
  /** O que há na prateleira hoje. `null` em serviço, que não tem estoque. */
  unidades: number | null;
};

export type LinhaLancada = { id: string; quantidade: number };

/**
 * O que o usuário digitou vira número.
 *
 * Campo vazio é zero, e não "não mexeu": apagar o número é como se tira um
 * lançamento errado. Quem não quis mexer simplesmente não digitou nada, e
 * aí nem passa por aqui.
 */
export function quantidadeDigitada(bruto: string): number {
  const digitos = bruto.replace(/\D/g, "").slice(0, 3);
  if (digitos === "") return 0;
  return Math.min(Number(digitos), QUANTIDADE_MAXIMA);
}

/**
 * O valor que a célula mostra: o que foi digitado agora, senão o que já
 * estava lançado, senão zero.
 *
 * Esta ordem é o que permite não copiar a resposta do banco para dentro de
 * um estado. Espelhar daria o bug clássico: a resposta chega depois do
 * primeiro quadro e sobrescreve o número que a pessoa acabou de digitar.
 */
export function quantidadeNaTela(
  id: string,
  digitado: Record<string, number>,
  jaLancado: Record<string, number>,
): number {
  return digitado[id] ?? jaLancado[id] ?? 0;
}

/**
 * O que vai para o banco.
 *
 * Linha zerada que NUNCA esteve lançada fica de fora — mandar quarenta
 * zeros só para o banco apagar quarenta linhas que não existem é trabalho
 * à toa, e no caso da loja chega a criar uma venda vazia para apagar em
 * seguida. Zero que JÁ esteve lançado vai, porque é ele que apaga.
 */
export function linhasParaSalvar(
  itens: ItemDoRegistro[],
  digitado: Record<string, number>,
  jaLancado: Record<string, number>,
): LinhaLancada[] {
  const linhas: LinhaLancada[] = [];

  for (const item of itens) {
    const quantidade = quantidadeNaTela(item.id, digitado, jaLancado);
    const antes = jaLancado[item.id] ?? 0;
    if (quantidade === 0 && antes === 0) continue;
    linhas.push({ id: item.id, quantidade });
  }

  return linhas;
}

/** Quanto o que está na tela soma, em centavos. */
export function totalLancado(
  itens: ItemDoRegistro[],
  digitado: Record<string, number>,
  jaLancado: Record<string, number>,
): number {
  let total = 0;
  for (const item of itens) {
    total +=
      item.precoCentavos * quantidadeNaTela(item.id, digitado, jaLancado);
  }
  return total;
}

export type FaltaNaPrateleira = {
  nome: string;
  pedido: number;
  disponivel: number;
};

/**
 * Produtos lançados além do que há na prateleira.
 *
 * Aviso adiantado, NÃO barreira: quem recusa é a `registrar_dia_manual`,
 * que lê o estoque dentro da mesma transação em que baixa. O número desta
 * tela pode estar velho — o QR da loja vende sozinho enquanto o modal está
 * aberto.
 *
 * O disponível soma de volta o que já estava lançado NESTE dia, porque
 * essas unidades já saíram do estoque: corrigir 10 para 8 devolve 2, não
 * pede mais 8.
 */
export function faltaNaPrateleira(
  produtos: ItemDoRegistro[],
  digitado: Record<string, number>,
  jaLancado: Record<string, number>,
): FaltaNaPrateleira[] {
  const faltas: FaltaNaPrateleira[] = [];

  for (const p of produtos) {
    if (p.unidades === null) continue;

    const pedido = quantidadeNaTela(p.id, digitado, jaLancado);
    const disponivel = p.unidades + (jaLancado[p.id] ?? 0);

    if (pedido > disponivel) {
      faltas.push({ nome: p.nome, pedido, disponivel });
    }
  }

  return faltas;
}

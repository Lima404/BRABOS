import { unstable_isUnrecognizedActionError } from "next/navigation";

/**
 * O erro veio de o navegador estar com uma VERSÃO ANTIGA do BARBOS?
 *
 * ============================================================
 * O CASO DO APLICATIVO INSTALADO NO IPHONE
 * ============================================================
 *
 * O iPhone deixa o BARBOS da tela de início aberto na memória por dias,
 * com o código da versão em que foi aberto. Se um deploy sai nesse meio
 * tempo, a página parada pede ao servidor coisas que não existem mais:
 *
 * - a AÇÃO DE SERVIDOR (o "Entrar" do login é uma) tem um identificador
 *   por build. O servidor novo não reconhece o antigo e o Next lança
 *   `UnrecognizedActionError` ("Server Action … was not found");
 * - os PEDAÇOS de JavaScript têm nome por build. O antigo dá 404 ao
 *   navegar para uma tela que ainda não tinha sido baixada.
 *
 * Nos dois casos recarregar resolve sozinho: a página nova vem com o
 * código novo. É o que o cliente fazia na mão tocando em "Reload".
 *
 * As mensagens de pedaço são de navegadores diferentes (Safari diz
 * "Importing a module script failed"; Chrome, "Failed to fetch dynamically
 * imported module"; o webpack, "ChunkLoadError").
 */
const MENSAGENS_DE_VERSAO =
  /UnrecognizedActionError|Failed to find Server Action|Server Action .* was not found|ChunkLoadError|Loading (CSS )?chunk .* failed|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;

export function ehErroDeVersaoAntiga(erro: unknown): boolean {
  if (unstable_isUnrecognizedActionError(erro)) return true;
  if (!(erro instanceof Error)) return false;
  return MENSAGENS_DE_VERSAO.test(`${erro.name} ${erro.message}`);
}

const CHAVE = "barbos-recarregou-por-versao";

/**
 * Janela da trava contra laço. Se a página recarregada cair de novo num
 * erro "de versão" dentro dela, o problema não era versão — e recarregar
 * outra vez só faria a tela piscar para sempre.
 */
const JANELA_MS = 30_000;

/**
 * A trava deixa recarregar agora? Só LÊ — quem grava é `recarregar()`.
 *
 * Separado de propósito: a tela chama isto ao decidir o primeiro desenho,
 * e decidir não pode ter efeito colateral (o React pode chamar o
 * inicializador do estado duas vezes em desenvolvimento).
 *
 * Sem `sessionStorage` (servidor, aba privada, armazenamento bloqueado)
 * não há como guardar a trava, então a resposta é NÃO: melhor mostrar a
 * tela de erro do que arriscar o laço.
 */
export function podeRecarregar(): boolean {
  try {
    const anterior = Number(sessionStorage.getItem(CHAVE) ?? 0);
    return Date.now() - anterior >= JANELA_MS;
  } catch {
    return false;
  }
}

/** Grava a trava e recarrega. Chamar só depois de `podeRecarregar()`. */
export function recarregar(): void {
  try {
    sessionStorage.setItem(CHAVE, String(Date.now()));
  } catch {
    return;
  }
  window.location.reload();
}

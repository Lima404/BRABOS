import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BUCKET_DAS_FOTOS,
  CAMINHO_DE_FOTO,
  type FotoDoPatch,
  type SecaoDoPatch,
} from "@/lib/comunicados/tipos";

/**
 * As fotos dos patch notes (0045), do lado do servidor.
 *
 * O bucket é PRIVADO: print do sistema pode mostrar cliente da barbearia de
 * teste. Toda conta logada pode ler, mas o navegador não manda a sessão
 * numa tag de imagem — então a tela recebe um endereço ASSINADO, gerado
 * aqui com a sessão de quem pediu, e que vence.
 */

export { BUCKET_DAS_FOTOS };

/**
 * Seis horas: mais que uma tarde com a tela aberta. Vencido, a foto que já
 * apareceu continua na tela; só a que ainda não tinha carregado falha, e
 * recarregar a página gera endereços novos.
 */
const VALIDADE_SEGUNDOS = 6 * 60 * 60;

/** Caminho → endereço assinado, numa chamada só para a página inteira. */
export async function assinarFotos(
  supabase: SupabaseClient,
  caminhos: string[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(caminhos.filter((c) => CAMINHO_DE_FOTO.test(c)))];
  const mapa = new Map<string, string>();
  if (unicos.length === 0) return mapa;

  const { data, error } = await supabase.storage
    .from(BUCKET_DAS_FOTOS)
    .createSignedUrls(unicos, VALIDADE_SEGUNDOS);

  if (error) {
    // Sem as fotos o texto do patch note continua valendo: registra e segue.
    console.error("[BARBOS] assinar fotos do patch note:", error.message);
    return mapa;
  }

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) mapa.set(item.path, item.signedUrl);
  }
  return mapa;
}

/** As seções cruas do banco viram `SecaoDoPatch`, com a foto já assinada. */
export function secoesComFotos(
  brutas: { titulo: unknown; texto: unknown; fotos: unknown }[],
  assinadas: Map<string, string>,
): SecaoDoPatch[] {
  return brutas.map((s) => ({
    titulo: String(s.titulo ?? ""),
    texto: String(s.texto ?? ""),
    fotos: (Array.isArray(s.fotos) ? s.fotos : [])
      .filter((c): c is string => typeof c === "string")
      .map((caminho): FotoDoPatch => ({ caminho, url: assinadas.get(caminho) ?? "" })),
  }));
}

/** Todos os caminhos de foto de uma lista de seções cruas. */
export function caminhosDasSecoes(brutas: { fotos: unknown }[]): string[] {
  return brutas.flatMap((s) =>
    (Array.isArray(s.fotos) ? s.fotos : []).filter(
      (c): c is string => typeof c === "string",
    ),
  );
}

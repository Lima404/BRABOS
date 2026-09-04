/**
 * Leitura das variaveis de ambiente do Supabase, em um lugar so.
 *
 * A chave publica tem dois nomes no mundo real: o painel novo do Supabase
 * emite NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_...), e projetos
 * mais antigos usam NEXT_PUBLIC_SUPABASE_ANON_KEY (JWT). Aceitamos os dois.
 *
 * Cada `process.env.NOME` precisa aparecer literalmente aqui: o Next substitui
 * a expressao inteira em tempo de build, entao acesso dinamico nao funciona.
 */

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;

export const SUPABASE_CHAVE =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true quando URL e chave existem. */
export const supabaseConfigurado = Boolean(SUPABASE_URL && SUPABASE_CHAVE);

/**
 * Garante configuracao ou explica o que falta — nunca deixa estourar um
 * "undefined is not a URL" sem contexto.
 */
export function exigirConfig(): { url: string; chave: string } {
  if (!SUPABASE_URL || !SUPABASE_CHAVE) {
    const faltando = [
      !SUPABASE_URL && "NEXT_PUBLIC_SUPABASE_URL",
      !SUPABASE_CHAVE && "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]
      .filter(Boolean)
      .join(" e ");

    throw new Error(
      `Supabase não configurado: falta ${faltando} em .env.local. ` +
        "As duas ficam em Supabase → Project Settings → Data API / API Keys.",
    );
  }
  return { url: SUPABASE_URL, chave: SUPABASE_CHAVE };
}

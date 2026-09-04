import { createBrowserClient } from "@supabase/ssr";

import { exigirConfig } from "@/lib/supabase/config";

/** Cliente do navegador. Usa a chave anon — publica por design. */
export function criarClienteNavegador() {
  const { url, chave } = exigirConfig();
  return createBrowserClient(url, chave);
}

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { exigirConfig } from "@/lib/supabase/config";

/**
 * Cliente do servidor (Server Components, Server Actions, Route Handlers).
 *
 * Precisa ser criado por requisicao: ele carrega os cookies daquele usuario.
 * Nunca guardar em variavel de modulo — sessao de um cliente vazaria pro outro.
 */
export async function criarClienteServidor() {
  const { url, chave } = exigirConfig();
  const armazem = await cookies();

  return createServerClient(url, chave, {
    cookies: {
      getAll() {
        return armazem.getAll();
      },
      setAll(paraGravar) {
        try {
          paraGravar.forEach(({ name, value, options }) =>
            armazem.set(name, value, options),
          );
        } catch {
          // Server Component nao pode gravar cookie. O middleware ja renova a
          // sessao antes de chegar aqui, entao ignorar e seguro.
        }
      },
    },
  });
}

import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { criarClienteServidor } from "@/lib/supabase/servidor";
import { supabaseConfigurado } from "@/lib/supabase/config";

/**
 * Destino do link de confirmacao do e-mail.
 *
 * Aceita os DOIS formatos que o Supabase pode mandar, de proposito:
 *
 * - `token_hash` + `type` — quando o modelo de e-mail usa {{ .TokenHash }}.
 *   Funciona mesmo se a pessoa se cadastrou no computador e abriu o e-mail no
 *   celular, porque nao depende de nada guardado no navegador.
 *
 * - `code` — fluxo PKCE do modelo padrao. So funciona no MESMO navegador em
 *   que o cadastro foi feito: o verificador fica num cookie daqui.
 *
 * Tratar os dois evita o caso mais chato de suporte: "cliquei no link e deu
 * erro" porque o e-mail foi aberto em outro aparelho.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const paraLogin = (motivo: string) =>
    NextResponse.redirect(`${origin}/entrar?aviso=${motivo}`);

  if (!supabaseConfigurado) return paraLogin("sem-configuracao");

  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const codigo = searchParams.get("code");

  const supabase = await criarClienteServidor();

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (error) {
      console.error("[BARBOS] confirmação falhou:", error.message);
      return paraLogin("link-invalido");
    }
    return NextResponse.redirect(`${origin}/agenda`);
  }

  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) {
      console.error("[BARBOS] troca de código falhou:", error.message);
      // Causa mais comum: e-mail aberto em outro navegador/aparelho.
      return paraLogin("outro-aparelho");
    }
    return NextResponse.redirect(`${origin}/agenda`);
  }

  return paraLogin("link-invalido");
}

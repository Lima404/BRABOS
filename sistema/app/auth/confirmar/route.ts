import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import {
  COOKIE_RECUPERACAO,
  ROTA_NOVA_SENHA,
  opcoesDoCookieDeRecuperacao,
} from "@/lib/auth/recuperacao";
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
 *
 * Serve a DOIS fluxos: confirmar conta nova e recuperar senha. Os dois acabam
 * com sessao valida; o que muda e o destino, e a marca de procedencia que a
 * recuperacao precisa deixar (ver lib/auth/recuperacao.ts).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const paraLogin = (motivo: string) =>
    NextResponse.redirect(`${origin}/entrar?aviso=${motivo}`);

  if (!supabaseConfigurado) return paraLogin("sem-configuracao");

  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const codigo = searchParams.get("code");

  // `proximo` e o unico jeito de saber que um `code` (PKCE) veio de um
  // pedido de recuperacao: diferente do `token_hash`, ele nao carrega o tipo.
  // Quem o coloca na URL e o `redirectTo` da acao de recuperar senha.
  //
  // So caminho interno: sem esta checagem, o link do e-mail viraria um
  // redirecionamento aberto — mandar a vitima para um site qualquer logo
  // depois de ela confiar num e-mail "do BARBOS" e phishing pronto.
  const pedido = searchParams.get("proximo");
  const proximo =
    pedido && pedido.startsWith("/") && !pedido.startsWith("//") ? pedido : null;

  const ehRecuperacao = tipo === "recovery" || proximo === ROTA_NOVA_SENHA;

  /** Sessao criada: manda pro lugar certo e, na recuperacao, deixa a marca. */
  const entrou = () => {
    const destino = ehRecuperacao ? ROTA_NOVA_SENHA : (proximo ?? "/agenda");
    const resposta = NextResponse.redirect(`${origin}${destino}`);

    if (ehRecuperacao) {
      resposta.cookies.set(
        COOKIE_RECUPERACAO,
        "1",
        opcoesDoCookieDeRecuperacao,
      );
    }

    return resposta;
  };

  const supabase = await criarClienteServidor();

  if (tokenHash && tipo) {
    const { error } = await supabase.auth.verifyOtp({
      type: tipo,
      token_hash: tokenHash,
    });
    if (error) {
      console.error("[BARBOS] confirmação falhou:", error.message);
      return paraLogin(ehRecuperacao ? "recuperacao-invalida" : "link-invalido");
    }
    return entrou();
  }

  if (codigo) {
    const { error } = await supabase.auth.exchangeCodeForSession(codigo);
    if (error) {
      console.error("[BARBOS] troca de código falhou:", error.message);
      // Causa mais comum: e-mail aberto em outro navegador/aparelho.
      return paraLogin(ehRecuperacao ? "recuperacao-outro-aparelho" : "outro-aparelho");
    }
    return entrou();
  }

  return paraLogin("link-invalido");
}

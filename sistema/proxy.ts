import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { SUPABASE_CHAVE, SUPABASE_URL } from "@/lib/supabase/config";

/**
 * Rotas de entrada: quem JÁ está logado não tem o que fazer nelas e é
 * mandado pra agenda.
 */
const ROTAS_DE_ENTRADA = [
  "/entrar",
  "/cadastrar",
  "/recuperar-senha",
  "/auth", // callback de confirmação de e-mail
];

/**
 * Rotas abertas: não exigem sessão.
 *
 * `/loja` e `/agendar` são abertas mas NÃO são rotas de entrada — quem lê o QR
 * code na parede da barbearia, ou recebe o link de agendamento no WhatsApp,
 * não tem conta; e a dona logada precisa poder abrir as duas telas sem ser
 * expulsa pra agenda. Confundir as duas listas quebra um dos dois lados.
 */
const ROTAS_ABERTAS = [...ROTAS_DE_ENTRADA, "/loja", "/agendar"];

function comecaCom(caminho: string, rotas: string[]): boolean {
  return rotas.some(
    (rota) => caminho === rota || caminho.startsWith(`${rota}/`),
  );
}

/** Cookie de sessão do Supabase, inclusive os partidos em pedaços (`.0`, `.1`). */
const COOKIE_SESSAO = /^sb-.+-auth-token(\.\d+)?$/;

/**
 * Proxy do Next 16 (antigo middleware).
 *
 * Renova a sessao a cada navegacao e barra quem nao esta logado.
 *
 * Roda antes de qualquer pagina. Se o Supabase ainda nao estiver configurado,
 * sai do caminho — assim o sistema continua abrindo enquanto as chaves nao
 * foram preenchidas.
 *
 * ATENÇÃO AO LAÇO DE REDIRECIONAMENTO. Este arquivo já causou
 * ERR_TOO_MANY_REDIRECTS de duas formas, e as duas defesas estão marcadas
 * abaixo com "// LAÇO:". Antes de mexer aqui, leia as duas.
 */
export async function proxy(request: NextRequest) {
  if (!SUPABASE_URL || !SUPABASE_CHAVE) return NextResponse.next();

  let resposta = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CHAVE, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(paraGravar) {
        paraGravar.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        resposta = NextResponse.next({ request });
        paraGravar.forEach(({ name, value, options }) =>
          resposta.cookies.set(name, value, options),
        );
      },
    },
  });

  const caminho = request.nextUrl.pathname;
  const ehAberta = comecaCom(caminho, ROTAS_ABERTAS);
  const ehDeEntrada = comecaCom(caminho, ROTAS_DE_ENTRADA);
  const ehApi = caminho.startsWith("/api/");

  // getUser() revalida o token no servidor do Supabase. Nao trocar por
  // getSession(), que confia no cookie sem verificar.
  let user = null;
  let alcancouOSupabase = true;
  try {
    ({
      data: { user },
    } = await supabase.auth.getUser());
  } catch (erro) {
    // Supabase fora do ar, sem rede, ou antivírus interceptando o TLS.
    console.error("[BARBOS] falha ao validar sessão:", erro);
    alcancouOSupabase = false;
  }

  // LAÇO 1: falha de transporte NÃO é "deslogado".
  //
  // A interceptação de HTTPS por antivírus é intermitente (ver a seção de
  // Windows no AGENTS.md): uma requisição falha, a seguinte funciona. Se
  // aqui tratássemos a falha como sessão ausente, o resultado seria
  //   /agenda -> falha -> /entrar -> funciona -> /agenda -> falha -> ...
  // até o navegador desistir com ERR_TOO_MANY_REDIRECTS.
  //
  // Não vaza nada deixar passar: quem isola os dados é o RLS do banco, não
  // este arquivo. Sem sessão válida a página abre e não traz linha nenhuma.
  if (!alcancouOSupabase) return resposta;

  if (!user && !ehAberta) {
    // Chamada de dados não segue redirecionamento de forma útil: o fetch
    // acompanha o 307, recebe o HTML do login com status 200, e o `.json()`
    // estoura na cara do usuário. 401 é a resposta honesta.
    if (ehApi) {
      return herdarCookies(
        resposta,
        NextResponse.json({ erro: "Sessão expirada." }, { status: 401 }),
      );
    }

    const destino = request.nextUrl.clone();
    destino.pathname = "/entrar";
    destino.search = "";
    // Guarda onde ele queria ir, pra devolver depois do login.
    if (caminho !== "/" && caminho !== "/agenda") {
      destino.searchParams.set("proximo", caminho);
    }

    const redirecionamento = herdarCookies(
      resposta,
      NextResponse.redirect(destino),
    );

    // Chegar aqui com cookie de sessão presente significa cookie inválido:
    // expirado, de outro projeto, ou partido pela metade. Apagar agora evita
    // que ele fique repetindo a mesma viagem a cada navegação.
    for (const cookie of request.cookies.getAll()) {
      if (COOKIE_SESSAO.test(cookie.name)) {
        redirecionamento.cookies.delete(cookie.name);
      }
    }

    return redirecionamento;
  }

  if (user && ehDeEntrada) {
    const destino = request.nextUrl.clone();
    destino.pathname = "/agenda";
    destino.search = "";
    return herdarCookies(resposta, NextResponse.redirect(destino));
  }

  return resposta;
}

/**
 * LAÇO 2: leva os cookies renovados para a resposta que vai embora.
 *
 * O `getUser()` acima pode ter girado o token — e quando gira, o antigo morre
 * na hora. Esses cookies novos foram escritos em `resposta`, que num
 * redirecionamento é jogada fora. Sem esta cópia o navegador guarda o token
 * velho, já inválido, e a navegação seguinte é barrada de novo:
 *   /entrar -> /agenda -> /entrar -> ...
 *
 * Não é detalhe de organização; é a diferença entre entrar e não entrar.
 */
function herdarCookies(
  origem: NextResponse,
  destino: NextResponse,
): NextResponse {
  for (const cookie of origem.cookies.getAll()) {
    destino.cookies.set(cookie);
  }
  return destino;
}

export const config = {
  matcher: [
    // Tudo, menos estaticos e imagens.
    "/((?!_next/static|_next/image|favicon.ico|marca/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};

/**
 * A marca que diz "esta sessão nasceu de um link de recuperação".
 *
 * ============================================================
 * POR QUE ISTO EXISTE
 * ============================================================
 *
 * Depois do `verifyOtp({ type: 'recovery' })` a pessoa fica com uma sessão
 * COMPLETA — igual à de quem entrou com e-mail e senha. Se a tela de trocar
 * senha exigisse só "ter sessão", ela ficaria aberta para qualquer um que
 * sentasse no computador do balcão com a sessão do dia ainda viva: trocar a
 * senha sem saber a antiga, e trancar o dono do lado de fora.
 *
 * Esse risco não é hipotético neste sistema. O AGENTS.md registra que os
 * barbeiros da equipe entram com o MESMO e-mail e senha da barbearia — a
 * sessão aberta no balcão é compartilhada por todo mundo que trabalha ali.
 *
 * Então a tela pede duas coisas: sessão válida E este cookie. Ele só é
 * gravado por `/auth/confirmar` ao consumir um token de recuperação, e some
 * assim que a senha é trocada.
 *
 * Não é um segredo nem um segundo fator: quem tem o cookie já tem a sessão.
 * É uma declaração de PROCEDÊNCIA — "esta sessão veio do e-mail" —, e por
 * isso `httpOnly` basta.
 */

export const COOKIE_RECUPERACAO = "barbos-recuperacao";

/**
 * Quinze minutos. Tempo de sobra para escolher uma senha e digitar duas
 * vezes, e curto o bastante para a janela fechar sozinha se a pessoa abrir o
 * link e for atender um cliente.
 */
export const VALIDADE_RECUPERACAO_SEG = 15 * 60;

/** Para onde o link de recuperação leva depois de virar sessão. */
export const ROTA_NOVA_SENHA = "/redefinir-senha";

/**
 * A marca do PEDIDO — gravada quando a pessoa clica em "Enviar link".
 *
 * Serve a um caso só, e ele é o caso NORMAL hoje: o Supabase só deixa editar
 * os modelos de e-mail com SMTP próprio configurado. Sem isso, o modelo é o
 * padrão, que usa `{{ .ConfirmationURL }}` e volta no formato PKCE (`?code=`)
 * — e esse formato NÃO carrega o tipo do token.
 *
 * O `?proximo=` que a ação coloca no `redirectTo` resolve isso, mas depende
 * de o Supabase preservar a query string do `redirect_to` ao anexar o código.
 * Se um dia não preservar, `/auth/confirmar` receberia um `code` pelado e
 * mandaria a pessoa para a agenda — sem erro nenhum, e sem trocar a senha.
 * Um recurso que falha em silêncio é pior que um que falha com estardalhaço.
 *
 * Este cookie fecha esse buraco sem custo: o código PKCE só pode ser trocado
 * no MESMO navegador que pediu (o verificador vive aqui), então nesse
 * navegador este cookie está garantidamente presente.
 */
export const COOKIE_PEDIU_RECUPERACAO = "barbos-pediu-recuperacao";

/** Uma hora — o mesmo prazo de validade do link do Supabase. */
export const VALIDADE_PEDIDO_SEG = 60 * 60;

export const opcoesDoCookieDeRecuperacao = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  // Em produção o site é HTTPS; em `localhost` marcar `secure` faria o
  // navegador descartar o cookie em silêncio e a tela diria "link inválido".
  secure: process.env.NODE_ENV === "production",
  maxAge: VALIDADE_RECUPERACAO_SEG,
};

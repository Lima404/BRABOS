/**
 * O piso de tamanho da senha, num lugar só.
 *
 * Mora aqui, e não dentro de cada ação, porque três telas precisam do MESMO
 * número e duas delas o mostram escrito ("pelo menos 8 caracteres"): cadastro,
 * redefinição pelo link do e-mail, e a mensagem de erro que o Supabase devolve
 * traduzida. Números iguais em arquivos diferentes divergem no primeiro
 * ajuste, e aí a tela promete um mínimo e o servidor cobra outro.
 *
 * O padrão do Supabase é 6. Oito é um piso melhor sem virar obstáculo para
 * quem digita no celular entre um corte e outro.
 *
 * Se subir daqui: contas antigas com senha menor continuam entrando — a regra
 * vale no momento de DEFINIR a senha, não no de usar. Quem quiser forçar a
 * troca precisa de outra coisa, não deste número.
 */
export const SENHA_MINIMA = 8;

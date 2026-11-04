/**
 * Os dois enderecos do BARBOS, num lugar so.
 *
 * O site de apresentacao e o sistema moram em hosts diferentes de
 * proposito: o sistema tem sessao, cookie e banco; o site nao tem nada
 * disso e por isso pode ser estatico, sem variavel de ambiente nenhuma.
 *
 * Como sao dois projetos separados na Vercel, o site NAO consegue
 * importar `sistema/lib/site.ts`. Entao o endereco do sistema aparece
 * aqui tambem — e e a unica coisa duplicada entre os dois projetos.
 * Se um dia o dominio mudar, muda nos dois.
 */

/** Onde este site mora. Base de todo link absoluto e do Open Graph. */
export const SITE = "https://site.barboss.com.br";

/**
 * Onde o sistema mora. Todo botao de "entrar" e "criar conta" aponta
 * pra ca — com `www`, que e o endereco de casa do sistema. Sem o `www`
 * o Next do sistema devolve um 308 e o visitante paga um salto a toa.
 */
export const SISTEMA = "https://www.barboss.com.br";

/** Onde o dono da barbearia cria a conta. */
export const CADASTRO = `${SISTEMA}/cadastrar`;

/** Onde quem ja tem conta entra. */
export const ENTRAR = `${SISTEMA}/entrar`;

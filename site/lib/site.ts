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
 * Onde o sistema mora. O botao de "entrar" aponta pra ca — com `www`,
 * que e o endereco de casa do sistema. Sem o `www` o Next do sistema
 * devolve um 308 e o visitante paga um salto a toa.
 */
export const SISTEMA = "https://www.barboss.com.br";

/**
 * Para onde vai todo botao de "abrir conta" e "criar conta": a secao de
 * planos, nesta mesma pagina. A conta so nasce depois do pagamento, entao
 * o caminho comeca sempre pela escolha do plano.
 */
export const PLANOS = "#planos";

/** Onde quem ja tem conta entra. */
export const ENTRAR = `${SISTEMA}/entrar`;

/**
 * O WhatsApp do BARBOS, o contato do rodape: fala direto com uma pessoa,
 * com a primeira mensagem ja escrita. Numero no formato internacional, so
 * digitos (55 + DDD 84).
 */
const WHATSAPP_NUMERO = "5584996308743";
const WHATSAPP_MENSAGEM =
  "Olá! Vim pelo site do BARBOS e quero abrir a conta da minha barbearia.";
export const WHATSAPP = whatsapp(WHATSAPP_MENSAGEM);

/** Uma conversa no WhatsApp do BARBOS com a primeira mensagem já escrita. */
export function whatsapp(mensagem: string): string {
  return `https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensagem)}`;
}

/** O Instagram do BARBOS. */
export const INSTAGRAM = "https://www.instagram.com/barboss.oficial/";

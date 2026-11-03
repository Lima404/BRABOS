/**
 * O endereço de casa do BARBOS.
 *
 * Comprado em 03/11/2026. Mora aqui, num lugar só, porque três partes
 * diferentes precisam concordar sobre ele: o redirecionamento do
 * `next.config.ts`, o `metadataBase` do layout e a variável
 * `VAPID_CONTATO` do aviso no celular. Domínio escrito à mão em cada um
 * deles diverge no primeiro ajuste.
 *
 * ============================================================
 * O ENDEREÇO DA VERCEL CONTINUA VALENDO
 * ============================================================
 *
 * `brabos-ruddy.vercel.app` **não deve ser removido do projeto**: links
 * de agendamento já foram mandados por WhatsApp e QR code de loja pode
 * já estar impresso apontando para lá. Papel na parede não se atualiza.
 *
 * Nada no sistema MONTA endereço a partir desta constante: o link que a
 * barbearia copia sai de `window.location.origin` e o link do e-mail sai
 * do cabeçalho da requisição. Então quem abrir pelo endereço antigo
 * continua recebendo links do endereço antigo, que funcionam.
 */
export const SITE = "https://www.barboss.com.br";

/**
 * O mesmo endereço sem o `www` — é dele que sai o redirecionamento.
 *
 * Só o host, sem protocolo: é com o cabeçalho `Host` que o Next compara.
 */
export const HOST_SEM_WWW = "barboss.com.br";

import type { NextConfig } from "next";

/**
 * O site de apresentacao nao le sessao, nao fala com banco e nao tem
 * variavel de ambiente — entao cada pagina e estatica e a Vercel serve
 * HTML pronto da borda.
 *
 * Nao ha regra de redirecionamento aqui. `site.barboss.com.br` e um host
 * so, e o redirecionamento de `barboss.com.br` para `www` vive no
 * `next.config.ts` do SISTEMA, que compara o cabecalho `Host` com o nome
 * exato — `site.barboss.com.br` nunca bate naquela regra.
 */
const nextConfig: NextConfig = {};

export default nextConfig;

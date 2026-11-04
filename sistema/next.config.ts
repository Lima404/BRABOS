import type { NextConfig } from "next";

import { HOST_SEM_WWW, SITE } from "./lib/site";

const nextConfig: NextConfig = {
  /**
   * `barboss.com.br` manda para `www.barboss.com.br`, com o caminho
   * inteiro junto.
   *
   * Um endereço só, e não dois servindo a mesma coisa: com os dois
   * abertos, a sessão não atravessa de um para o outro (cookie é por
   * host), então quem entrasse pelo `www` e abrisse um link sem ele
   * apareceria deslogado — e ainda ficariam duas versões de cada página
   * para o buscador.
   *
   * Isto é o mesmo que o redirecionamento do painel da Vercel faria, mas
   * fica VERSIONADO aqui: quem clonar o projeto lê a regra no código em
   * vez de descobrir numa tela de configuração. Se um dia o painel também
   * for configurado, ele age antes e esta regra nunca dispara — não há
   * conflito.
   *
   * `permanent: true` = 308, que preserva método e corpo. Com 301/302 um
   * POST de ação de servidor viraria GET no caminho.
   *
   * O endereço da Vercel (`brabos-ruddy.vercel.app`) NÃO entra aqui de
   * propósito — ver o comentário em `lib/site.ts`.
   */
  async redirects() {
    return [
      {
        source: "/:caminho*",
        has: [{ type: "host", value: HOST_SEM_WWW }],
        destination: `${SITE}/:caminho*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;

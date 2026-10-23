import type { MetadataRoute } from "next";

/**
 * O manifesto que transforma o BARBOS em aplicativo instalável.
 *
 * Existe por causa do aviso de agendamento. **No iPhone, notificação só
 * funciona com o site adicionado à tela de início** (iOS 16.4+), e o
 * Safari só oferece a instalação direito quando há manifesto com
 * `display: standalone`. Sem este arquivo, a feature simplesmente não
 * acontece no aparelho que a dona tem na mão.
 *
 * `start_url` aponta para a agenda e não para `/`: quem abre o ícone na
 * tela de início quer ver o dia, e `/` só redireciona para lá — um salto a
 * mais, visível, toda vez que o app abre.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BARBOS — gestão da barbearia",
    short_name: "BARBOS",
    description:
      "Agenda, serviços e estoque da barbearia, com aviso de agendamento online.",
    start_url: "/agenda",
    display: "standalone",
    orientation: "portrait",
    // `--background` do tema escuro (graf-950) em `globals.css`. Hex solto aqui é
    // inevitável — o manifesto é JSON e não enxerga variável de CSS —,
    // então ficam anotados: se a paleta mudar, estes dois vêm junto.
    background_color: "#0d0f12",
    theme_color: "#0d0f12",
    lang: "pt-BR",
    icons: [
      {
        src: "/marca/icone-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/marca/icone-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}

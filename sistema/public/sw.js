/**
 * BARBOS — service worker do aviso de agendamento.
 *
 * Só existe para uma coisa: mostrar a notificação quando alguém marca
 * horário pelo link público. Ele roda FORA da página, então o aviso chega
 * com o BARBOS fechado — é esse o ponto todo.
 *
 * Mora em `public/` para ser servido em `/sw.js`. O caminho decide o
 * alcance: um service worker só manda no que está abaixo dele, e registrado
 * de `/alguma/pasta/sw.js` ele não enxergaria o resto do site.
 *
 * NÃO faz cache de nada. Transformar isto num worker offline é mexer num
 * arquivo que o navegador guarda com teimosia — e quebrar o cache de um
 * sistema que a barbearia usa o dia todo é bem pior que não ter offline.
 */

self.addEventListener("install", () => {
  // Assume o lugar do worker anterior sem esperar as abas fecharem. Sem
  // isto, uma aba aberta desde ontem segura a versão velha de pé.
  self.skipWaiting();
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(self.clients.claim());
});

self.addEventListener("push", (evento) => {
  // Sem dados não há o que mostrar, mas também não dá para ignorar: alguns
  // navegadores mostram uma notificação genérica ("Este site foi
  // atualizado em segundo plano") quando o worker recebe push e não
  // notifica nada. Melhor um texto nosso que um texto do navegador.
  let dados = {};
  try {
    dados = evento.data ? evento.data.json() : {};
  } catch (erro) {
    console.error("[BARBOS] push sem JSON:", erro);
  }

  const titulo = dados.titulo || "Novo agendamento";
  const opcoes = {
    body: dados.corpo || "Alguém marcou um horário pelo link.",
    icon: "/marca/icone-192.png",
    badge: "/marca/icone-192.png",
    // `tag` sem `renotify` faria o segundo aviso SUBSTITUIR o primeiro em
    // silêncio: duas pessoas marcando em seguida viravam uma notificação
    // só. Cada agendamento tem a sua etiqueta, então ninguém engole ninguém.
    tag: dados.tag || `agendamento-${Date.now()}`,
    // Fica na tela até a dona tocar. Ela está cortando cabelo — um aviso
    // que some em quatro segundos não serve de nada.
    requireInteraction: true,
    data: { url: dados.url || "/agenda" },
  };

  evento.waitUntil(self.registration.showNotification(titulo, opcoes));
});

self.addEventListener("notificationclick", (evento) => {
  evento.notification.close();
  const destino = (evento.notification.data && evento.notification.data.url) || "/agenda";

  evento.waitUntil(
    (async () => {
      const abas = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Reaproveita uma aba do BARBOS se já houver uma: abrir a quinta aba
      // do mesmo sistema é o que acontece quando ninguém procura antes.
      for (const aba of abas) {
        if (new URL(aba.url).origin === self.location.origin) {
          await aba.focus();
          if ("navigate" in aba) await aba.navigate(destino);
          return;
        }
      }

      await self.clients.openWindow(destino);
    })(),
  );
});

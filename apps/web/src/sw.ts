/// <reference lib="webworker" />

import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import type { Notifica } from 'modello';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { url: string; revision: string | null }>;
};

const OFFLINE_URL = '/offline.html';

precacheAndRoute(self.__WB_MANIFEST);

cleanupOutdatedCaches();

registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/offline\.html$/],
  }),
);

setCatchHandler(async ({ request }) => {
  if (request.mode === 'navigate') {
    const cached = await matchPrecache(OFFLINE_URL);
    if (cached) return cached;
  }
  return Response.error();
});

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  const data = event.data as { type?: string } | undefined;
  if (data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

// Arriva dal servizio di push anche a scheda chiusa
self.addEventListener('push', (event: PushEvent) => {
  if (!event.data) return;
  const notifica = event.data.json() as Notifica;

  // Il browser può fermare il service worker 
  event.waitUntil(
    self.registration.showNotification(notifica.titolo, {
      body: notifica.testo,
      // Una notifica nuova con la stessa etichetta sostituisce la precedente
      tag: notifica.etichetta,
      icon: '/icon-192.png',
      data: { indirizzo: notifica.indirizzo },
    }),
  );
});


self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const indirizzo = (event.notification.data as { indirizzo?: string } | null)?.indirizzo ?? '/';

  event.waitUntil(
    (async () => {
      const schede = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const aperta = schede[0];
      if (!aperta) {
        await self.clients.openWindow(indirizzo);
        return;
      }
      aperta.postMessage({ tipo: 'apri', indirizzo });
      await aperta.focus();
    })(),
  );
});

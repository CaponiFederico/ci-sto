import { registerSW } from 'virtual:pwa-register';

export function setupPwa() {
  // Il service worker chiede di aprire una pagina quando si tocca una notifica
  navigator.serviceWorker?.addEventListener('message', (evento: MessageEvent) => {
    const dati = evento.data as { tipo?: string; indirizzo?: string } | undefined;
    if (dati?.tipo !== 'apri' || !dati.indirizzo) return;
    const cancelletto = dati.indirizzo.indexOf('#');
    location.hash = cancelletto === -1 ? '#/' : dati.indirizzo.slice(cancelletto);
  });

  return registerSW({
    immediate: true,

    onRegisteredSW(url) {
      console.info('[pwa] service worker registrato:', url);
    },

    onRegisterError(error) {
      console.error('[pwa] registrazione del service worker fallita:', error);
    },

    onOfflineReady() {
      console.info('[pwa] contenuti in cache: l’app funziona offline');
    },

    onNeedRefresh() {
      console.info('[pwa] è disponibile una nuova versione');
    },
  });
}

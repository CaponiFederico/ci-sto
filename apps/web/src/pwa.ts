import { registerSW } from 'virtual:pwa-register';

export function setupPwa() {
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

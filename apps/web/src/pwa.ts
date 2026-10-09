import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

const NUOVA_VERSIONE = 'bacheca:nuova-versione';

let nuovaVersione = false;
let aggiornaSW: ((ricarica?: boolean) => Promise<void>) | undefined;

export function setupPwa() {
  // Il service worker chiede di aprire una pagina quando si tocca una notifica
  navigator.serviceWorker?.addEventListener('message', (evento: MessageEvent) => {
    const dati = evento.data as { tipo?: string; indirizzo?: string } | undefined;
    if (dati?.tipo !== 'apri' || !dati.indirizzo) return;
    const cancelletto = dati.indirizzo.indexOf('#');
    location.hash = cancelletto === -1 ? '#/' : dati.indirizzo.slice(cancelletto);
  });

  aggiornaSW = registerSW({
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
      nuovaVersione = true;
      window.dispatchEvent(new Event(NUOVA_VERSIONE));
    },
  });
}

// Attiva il service worker in attesa e ricarica la pagina
export function applicaAggiornamento() {
  void aggiornaSW?.(true);
}

// Hook per sapere se c'è una versione nuova pronta
export function useNuovaVersione() {
  const [pronta, setPronta] = useState(nuovaVersione);

  useEffect(() => {
    const arrivata = () => setPronta(true);
    window.addEventListener(NUOVA_VERSIONE, arrivata);
    return () => window.removeEventListener(NUOVA_VERSIONE, arrivata);
  }, []);

  return pronta;
}

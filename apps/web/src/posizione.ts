import type { LuogoTrovato, Punto } from 'modello';
import { createContext, use, useEffect, useState } from 'react';

// ignota: non si sa ancora nulla
// in_corso: il browser sta chiedendo il permesso
// nota: la posizione è stata letta
// negata: l'utente ha negato il permesso
// non_disponibile: il browser non supporta la geolocalizzazione
export type StatoPosizione = 'ignota' | 'in_corso' | 'nota' | 'negata' | 'non_disponibile';

export interface Posizione {
  punto: Punto | null;
  stato: StatoPosizione;
  chiedi: () => void;
  aMano: LuogoTrovato | null;
  scegli: (luogo: LuogoTrovato | null) => void;
}

const RICORDO = 'bacheca:posizione';

function ricordata(): LuogoTrovato | null {
  try {
    const letta = JSON.parse(localStorage.getItem(RICORDO) ?? 'null') as Partial<LuogoTrovato> | null;
    const valida = typeof letta?.nome === 'string' && Number.isFinite(letta.lat) && Number.isFinite(letta.lon);
    return valida ? (letta as LuogoTrovato) : null;
  } catch {
    return null;
  }
}

export function dimenticaPosizione() {
  localStorage.removeItem(RICORDO);
}

// La posizione di chi guarda resta in memoria nel browser
export const ContestoPosizione = createContext<Posizione | null>(null);

export function usePosizione() {
  const posizione = use(ContestoPosizione);
  if (!posizione) throw new Error('usePosizione fuori da una sessione aperta');
  return posizione;
}

export function rileva(trovata: (punto: Punto) => void, esito: (stato: StatoPosizione) => void) {
  if (!('geolocation' in navigator)) {
    esito('non_disponibile');
    return;
  }

  esito('in_corso');
  navigator.geolocation.getCurrentPosition(
    (p) => {
      trovata({ lat: p.coords.latitude, lon: p.coords.longitude });
      esito('nota');
    },
    (errore) => esito(errore.code === errore.PERMISSION_DENIED ? 'negata' : 'non_disponibile'),
    { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 10_000 },
  );
}

export function useRilevaPosizione(): Posizione {
  const [rilevata, setRilevata] = useState<Punto | null>(null);
  const [stato, setStato] = useState<StatoPosizione>('ignota');
  const [aMano, setAMano] = useState(ricordata);

  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' })
      .then((permesso) => {
        if (permesso.state === 'granted') rileva(setRilevata, setStato);
      })
      .catch(() => {});
  }, []);

  function scegli(luogo: LuogoTrovato | null) {
    if (luogo) localStorage.setItem(RICORDO, JSON.stringify(luogo));
    else dimenticaPosizione();
    setAMano(luogo);
  }

  return {
    punto: aMano ?? rilevata,
    stato: aMano ? 'nota' : stato,
    chiedi: () => rileva(setRilevata, setStato),
    aMano,
    scegli,
  };
}

import { createContext, use, useEffect, useState } from 'react';
import { provaNotifica } from './azioni';
import {
  attivaNotifiche,
  disattivaNotifiche,
  SERVIZIO_NON_RAGGIUNTO,
  statoNotifiche,
  type StatoNotifiche,
} from './notifiche';
import { NOTIFICHE } from './testi';

export interface Notifiche {
  stato: StatoNotifiche | null;
  messaggio: string | null;
  inCorso: boolean;
  attiva: () => void;
  disattiva: () => void;
  prova: () => void;
}

export const ContestoNotifiche = createContext<Notifiche | null>(null);

export function useNotifiche() {
  const notifiche = use(ContestoNotifiche);
  if (!notifiche) throw new Error('useNotifiche fuori dall’app');
  return notifiche;
}


export function useGestisciNotifiche(uid: string | null): Notifiche {
  const [stato, setStato] = useState<StatoNotifiche | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    if (!uid) return;
    let attuale = true;
    statoNotifiche(uid)
      .then((letto) => attuale && setStato(letto))
      .catch(() => attuale && setStato('spente'));
    return () => {
      attuale = false;
      setStato(null);
      setMessaggio(null);
    };
  }, [uid]);

  async function esegui(operazione: (uid: string) => Promise<void>) {
    if (!uid) return;
    setInCorso(true);
    setMessaggio(null);
    try {
      await operazione(uid);
    } catch (errore) {
      const servizio = errore instanceof Error && errore.message === SERVIZIO_NON_RAGGIUNTO;
      setMessaggio(servizio ? NOTIFICHE.servizio : NOTIFICHE.errore);
    } finally {
      setInCorso(false);
    }
  }

  return {
    stato,
    messaggio,
    inCorso,
    attiva: () => void esegui(async (io) => setStato(await attivaNotifiche(io))),
    disattiva: () =>
      void esegui(async (io) => {
        await disattivaNotifiche(io);
        setStato('spente');
      }),
    prova: () =>
      void esegui(async () => {
        const { inviate } = await provaNotifica();
        setMessaggio(inviate > 0 ? NOTIFICHE.provaInviata : NOTIFICHE.provaFallita);
      }),
  };
}

import { useEffect, useState } from 'react';
import { provaNotifica } from '../azioni';
import {
  attivaNotifiche,
  disattivaNotifiche,
  SERVIZIO_NON_RAGGIUNTO,
  statoNotifiche,
  type StatoNotifiche,
} from '../notifiche';
import { NOTIFICHE } from '../testi';

// Lo stato delle notifiche su questo dispositivo e i bottoni per cambiarlo
export function Notifiche({ uid }: { uid: string }) {
  const [stato, setStato] = useState<StatoNotifiche | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  useEffect(() => {
    let attuale = true;
    statoNotifiche(uid)
      .then((letto) => attuale && setStato(letto))
      .catch(() => attuale && setStato('spente'));
    return () => {
      attuale = false;
    };
  }, [uid]);

  async function esegui(operazione: () => Promise<void>) {
    setInCorso(true);
    setMessaggio(null);
    try {
      await operazione();
    } catch (errore) {
      const servizio = errore instanceof Error && errore.message === SERVIZIO_NON_RAGGIUNTO;
      setMessaggio(servizio ? NOTIFICHE.servizio : NOTIFICHE.errore);
    } finally {
      setInCorso(false);
    }
  }

  if (stato === null || stato === 'non_supportate') return null;

  return (
    <p className="notifiche">
      {stato === 'negate' && NOTIFICHE.negate}

      {stato === 'spente' && (
        <button
          type="button"
          className="secondario"
          disabled={inCorso}
          onClick={() => void esegui(async () => setStato(await attivaNotifiche(uid)))}
        >
          {NOTIFICHE.attiva}
        </button>
      )}

      {stato === 'attive' && (
        <>
          {NOTIFICHE.attive}{' '}
          <button
            type="button"
            className="secondario"
            disabled={inCorso}
            onClick={() =>
              void esegui(async () => {
                const { inviate } = await provaNotifica();
                setMessaggio(inviate > 0 ? NOTIFICHE.provaInviata : NOTIFICHE.provaFallita);
              })
            }
          >
            {NOTIFICHE.prova}
          </button>{' '}
          <button
            type="button"
            className="secondario"
            disabled={inCorso}
            onClick={() =>
              void esegui(async () => {
                await disattivaNotifiche(uid);
                setStato('spente');
              })
            }
          >
            {NOTIFICHE.disattiva}
          </button>
        </>
      )}

      {messaggio && <span role="status"> {messaggio}</span>}
    </p>
  );
}

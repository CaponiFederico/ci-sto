import { useNotifiche } from '../stato-notifiche';
import { NOTIFICHE } from '../testi';

// Lo stato delle notifiche su questo dispositivo e i bottoni per cambiarlo
export function Notifiche() {
  const { stato, messaggio, inCorso, attiva, disattiva, prova } = useNotifiche();

  if (stato === null || stato === 'non_supportate') return null;

  return (
    <p className="notifiche">
      {stato === 'negate' && NOTIFICHE.negate}

      {stato === 'spente' && (
        <button type="button" className="secondario" disabled={inCorso} onClick={attiva}>
          {NOTIFICHE.attiva}
        </button>
      )}

      {stato === 'attive' && (
        <>
          {NOTIFICHE.attive}{' '}
          <button type="button" className="secondario" disabled={inCorso} onClick={prova}>
            {NOTIFICHE.prova}
          </button>{' '}
          <button type="button" className="secondario" disabled={inCorso} onClick={disattiva}>
            {NOTIFICHE.disattiva}
          </button>
        </>
      )}

      {messaggio && <span role="status"> {messaggio}</span>}
    </p>
  );
}

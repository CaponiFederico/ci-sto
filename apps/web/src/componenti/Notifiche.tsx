import { useNotifiche } from '../stato-notifiche';
import { NOTIFICHE } from '../testi';

// stato delle notifiche 
export function Notifiche() {
  const { stato, messaggio, inCorso, attiva, disattiva, prova } = useNotifiche();

  if (stato === null) return null;
  if (stato === 'non_supportate') return <p>{NOTIFICHE.nonSupportate}</p>;

  return (
    <div className="notifiche">
      {stato === 'negate' && <p>{NOTIFICHE.negate}</p>}

      {stato === 'spente' && (
        <button type="button" className="secondario" disabled={inCorso} onClick={attiva}>
          {NOTIFICHE.attiva}
        </button>
      )}

      {stato === 'attive' && (
        <>
          <p>{NOTIFICHE.attive}</p>
          <div className="bottoni">
            <button type="button" className="secondario" disabled={inCorso} onClick={prova}>
              {NOTIFICHE.prova}
            </button>
            <button type="button" className="secondario" disabled={inCorso} onClick={disattiva}>
              {NOTIFICHE.disattiva}
            </button>
          </div>
        </>
      )}

      {messaggio && <p role="status">{messaggio}</p>}
    </div>
  );
}

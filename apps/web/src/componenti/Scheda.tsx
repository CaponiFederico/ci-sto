import type { StatoPartecipante } from 'modello';
import type { AttivitaConId } from '../dati';
import { useUtente } from '../sessione';
import { CATEGORIA, MIO_STATO, posti, quando } from '../testi';
import { Nome } from './Nome';

interface Proprieta {
  attivita: AttivitaConId;
  mioStato?: StatoPartecipante;
}

export function Scheda({ attivita, mioStato }: Proprieta) {
  const utente = useUtente();
  const annullata = attivita.stato === 'annullata';
  const organizzo = attivita.organizzatore === utente.uid;

  return (
    <article className={annullata ? 'scheda annullata' : 'scheda'}>
      <p className="etichette">
        <span className="etichetta">{CATEGORIA[attivita.categoria]}</span>
        {organizzo && <span className="etichetta">Organizzata da te</span>}
        {mioStato && !organizzo && !annullata && (
          <span className={mioStato === 'da_confermare' ? 'etichetta evidenza' : 'etichetta'}>
            {MIO_STATO[mioStato]}
          </span>
        )}
      </p>

      <h3>
        <a href={`#/attivita/${attivita.id}`}>{attivita.titolo}</a>
      </h3>

      <p className="dettagli">
        <time dateTime={new Date(attivita.inizio).toISOString()}>{quando(attivita.inizio)}</time>
        {' · '}
        {attivita.durataMinuti} min
        {' · '}
        {attivita.luogo.testo}
        {' · '}
        <Nome uid={attivita.organizzatore} />
      </p>

      <p className="posti">{posti(attivita)}</p>
    </article>
  );
}

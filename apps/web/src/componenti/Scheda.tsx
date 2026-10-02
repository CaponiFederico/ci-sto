import type { AttivitaConId } from '../dati';
import { useUtente } from '../sessione';
import { CATEGORIA, posti, quando } from '../testi';
import { Nome } from './Nome';

export function Scheda({ attivita }: { attivita: AttivitaConId }) {
  const utente = useUtente();
  const annullata = attivita.stato === 'annullata';

  return (
    <article className={annullata ? 'scheda annullata' : 'scheda'}>
      <p className="etichette">
        <span className="etichetta">{CATEGORIA[attivita.categoria]}</span>
        {attivita.organizzatore === utente.uid && <span className="etichetta">Organizzata da te</span>}
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

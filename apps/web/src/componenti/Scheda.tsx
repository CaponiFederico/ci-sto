import { distanzaKm, type StatoPartecipante } from 'modello';
import type { AttivitaConId } from '../dati';
import { usePosizione } from '../posizione';
import { useUtente } from '../sessione';
import { aDistanza, CATEGORIA, ETICHETTA_SOSPESA, MIO_STATO, posti, quando, type StatoSospesa } from '../testi';
import { Nome } from './Nome';

interface Proprieta {
  attivita: AttivitaConId;
  mioStato?: StatoPartecipante;
  sospesa?: StatoSospesa;
  cominciata?: boolean;
  motivo?: string;
}

export function Scheda({ attivita, mioStato, sospesa, cominciata = false, motivo }: Proprieta) {
  const utente = useUtente();
  const annullata = attivita.stato === 'annullata';
  const organizzo = attivita.organizzatore === utente.uid;
  const { punto } = usePosizione();
  const { lat, lon } = attivita.luogo;
  const distanza = punto && lat !== undefined && lon !== undefined ? distanzaKm(punto, { lat, lon }) : null;

  return (
    <article className={annullata ? 'scheda annullata' : 'scheda'}>
      <p className="etichette">
        <span className="etichetta">{CATEGORIA[attivita.categoria]}</span>
        {organizzo && <span className="etichetta">Organizzata da te</span>}
        {cominciata && !annullata && <span className="etichetta">Già cominciata</span>}
        {mioStato && !organizzo && !annullata && (
          <span className={mioStato === 'da_confermare' ? 'etichetta evidenza' : 'etichetta'}>
            {MIO_STATO[mioStato]}
          </span>
        )}
        {sospesa && (
          <span className="etichetta evidenza">
            {ETICHETTA_SOSPESA[sospesa]}
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
        {distanza !== null && ` (${aDistanza(distanza)})`}
        {' · '}
        <Nome uid={attivita.organizzatore} />
      </p>

      <p className="posti">{posti(attivita)}</p>
      {motivo && !annullata && <p className="motivo">{motivo}</p>}
    </article>
  );
}

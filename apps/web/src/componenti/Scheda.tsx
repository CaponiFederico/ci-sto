import { distanzaKm, type StatoPartecipante } from 'modello';
import { useActionState } from 'react';
import type { AttivitaConId } from '../dati';
import { usePosizione } from '../posizione';
import { useUtente } from '../sessione';
import { aDistanza, CATEGORIA, ETICHETTA_SOSPESA, MIO_STATO, posti, quando, type StatoSospesa } from '../testi';
import { richiedi } from './Iscrizione';
import { Nome } from './Nome';

interface Proprieta {
  attivita: AttivitaConId;
  mioStato?: StatoPartecipante;
  statoNoto: boolean;
  sospesa?: StatoSospesa;
  cominciata?: boolean;
  motivo?: string;
}

export function Scheda({ attivita, mioStato, statoNoto, sospesa, cominciata = false, motivo }: Proprieta) {
  const utente = useUtente();
  const annullata = attivita.stato === 'annullata';
  const organizzo = attivita.organizzatore === utente.uid;
  const { punto } = usePosizione();
  const { lat, lon } = attivita.luogo;
  const distanza = punto && lat !== undefined && lon !== undefined ? distanzaKm(punto, { lat, lon }) : null;
  const pieni = attivita.postiOccupati >= attivita.capacita;

  // Dall'elenco ci si può solo iscrivere
  const puoIscriversi = statoNoto && !mioStato && !sospesa && !organizzo && !annullata && !cominciata;
  const [avviso, iscriviti, inCorso] = useActionState(() => richiedi('iscrivi', attivita, utente.uid), null);

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

      <div className="posti">
        <p>
          {!annullata && (
            // Il numero è già scritto accanto: la barra serve solo all'occhio
            <meter
              aria-hidden="true"
              min={0}
              max={attivita.capacita}
              value={attivita.postiOccupati}
              low={attivita.capacita * 0.5}
              high={attivita.capacita * 0.8}
              optimum={0}
            />
          )}
          {posti(attivita)}
        </p>
        {puoIscriversi && (
          <form action={iscriviti}>
            <button type="submit" disabled={inCorso}>
              {pieni ? 'Mettiti in lista' : 'Iscriviti'}
            </button>
          </form>
        )}
      </div>
      {avviso && (
        <p className="errore" role="alert">
          {avviso}
        </p>
      )}
      {motivo && !annullata && <p className="motivo">{motivo}</p>}
    </article>
  );
}

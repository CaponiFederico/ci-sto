import { useActionState } from 'react';
import { ErroreApi } from '../api';
import { creaAttivita } from '../azioni';
import { Campi } from '../componenti/Campi';
import { daModulo, inAttivita, VALORI_INIZIALI, type Valori } from '../modulo';
import { vai } from '../percorso';

interface Stato {
  valori: Valori;
  errori: string[];
  avviso: string | null;
}

const INIZIALE: Stato = { valori: VALORI_INIZIALI, errori: [], avviso: null };

// Funzione per pubblicare una nuova attività
async function pubblica(_prima: Stato, dati: FormData): Promise<Stato> {
  const valori = daModulo(dati);

  try {
    const { id } = await creaAttivita(inAttivita(valori));
    vai(`/attivita/${id}`);
    return { valori, errori: [], avviso: null };
  } catch (e) {
    if (e instanceof ErroreApi && e.codice === 'dati_non_validi') {
      return { valori, errori: e.campi, avviso: null };
    }
    const irraggiungibile = e instanceof ErroreApi && e.codice === 'api_irraggiungibile';
    return {
      valori,
      errori: [],
      avviso: irraggiungibile
        ? 'Il servizio non risponde. Riprova fra poco.'
        : 'Non è stato possibile pubblicare l’attività. Riprova.',
    };
  }
}

export function Nuova() {
  const [stato, invia, inCorso] = useActionState(pubblica, INIZIALE);

  return (
    <>
      <div className="barra">
        <h2>Appendi un annuncio</h2>
        <a href="#/">Annulla</a>
      </div>

      <form className="modulo" action={invia}>
        <Campi valori={stato.valori} errori={stato.errori} />

        {stato.avviso && (
          <p className="errore" role="alert">
            {stato.avviso}
          </p>
        )}

        <button type="submit" disabled={inCorso}>
          {inCorso ? 'Pubblicazione…' : 'Appendi'}
        </button>
      </form>
    </>
  );
}

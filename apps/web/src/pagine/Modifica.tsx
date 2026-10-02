import { entitaModifica } from 'modello';
import { useActionState, useState } from 'react';
import { ErroreApi } from '../api';
import { annulla, modifica } from '../azioni';
import { Campi } from '../componenti/Campi';
import { Conferma, type Domanda } from '../componenti/Conferma';
import { useAttivita, type AttivitaConId } from '../dati';
import { cambiati, daAttivita, daModulo, type Valori } from '../modulo';
import { vai } from '../percorso';
import { useUtente } from '../sessione';
import { avvisoAnnullamento, domandaMaggiore, messaggioModifica } from '../testi';

const SERVIZIO = 'Il servizio non risponde. Riprova fra poco.';

export function Modifica({ id }: { id: string }) {
  const utente = useUtente();
  const { attivita, errore } = useAttivita(id);
  const [adesso] = useState(Date.now);

  // Chi non può modificare non vede il modulo
  function impedimento() {
    if (errore) return 'Non è stato possibile leggere l’attività. Riprova fra poco.';
    if (attivita === undefined) return 'Caricamento…';
    if (attivita === null) return 'Questa attività non esiste.';
    if (attivita.organizzatore !== utente.uid) return 'Solo chi organizza può modificare l’attività.';
    if (attivita.stato === 'annullata') return 'L’attività è stata annullata: non si può più modificare.';
    if (attivita.inizio <= adesso) return 'L’attività è già cominciata: non si può più modificare.';
    return null;
  }
  const motivo = impedimento();

  return (
    <>
      <p className="ritorno">
        <a href={`#/attivita/${id}`}>← Attività</a>
      </p>

      {motivo || !attivita ? (
        <p className="vuoto">{motivo}</p>
      ) : (
        <>
          <ModuloModifica attivita={attivita} />
          <Annullamento attivita={attivita} />
        </>
      )}
    </>
  );
}

interface Stato {
  valori: Valori;
  errori: string[];
  avviso: string | null;
  salvato: string | null;
  conferma: (Domanda & { su: 'maggiore' | 'riduzione' }) | null;
}

function ModuloModifica({ attivita }: { attivita: AttivitaConId }) {
  const [stato, invia, inCorso] = useActionState(
    async (prima: Stato, dati: FormData): Promise<Stato> => {
      const valori = daModulo(dati);
      const pulito: Stato = { valori, errori: [], avviso: null, salvato: null, conferma: null };
      const passo = dati.get('passo');
      if (passo === 'indietro') return pulito;

      const campi = cambiati(daAttivita(attivita), valori);
      if (Object.keys(campi).length === 0) return { ...pulito, salvato: 'Nessuna modifica da salvare.' };

      const confermato = passo === 'conferma' ? prima.conferma?.su : undefined;

      const altri = attivita.postiOccupati - 1;
      if (!confermato && altri > 0 && entitaModifica(attivita, { ...attivita, ...campi }) === 'maggiore') {
        return { ...pulito, conferma: { su: 'maggiore', testo: domandaMaggiore(altri) } };
      }

      try {
        const esito = await modifica(attivita.id, campi, confermato === 'riduzione');
        const testo = messaggioModifica(esito);
        if (esito.esito === 'conferma_richiesta') return { ...pulito, conferma: { su: 'riduzione', testo } };
        return esito.esito === 'rifiutato' ? { ...pulito, avviso: testo } : { ...pulito, salvato: testo };
      } catch (e) {
        if (e instanceof ErroreApi && e.codice === 'dati_non_validi') return { ...pulito, errori: e.campi };
        return { ...pulito, avviso: SERVIZIO };
      }
    },
    { valori: daAttivita(attivita), errori: [], avviso: null, salvato: null, conferma: null },
  );

  return (
    <>
      <div className="barra">
        <h2>Modifica attività</h2>
      </div>

      <form className="modulo" action={invia}>
        <Campi valori={stato.valori} errori={stato.errori} politicaBloccata={attivita.inAttesa > 0} />

        {stato.avviso && (
          <p className="errore" role="alert">
            {stato.avviso}
          </p>
        )}
        {stato.salvato && (
          <p className="salvato" role="status">
            {stato.salvato}
          </p>
        )}

        <button type="submit" name="passo" value="salva" disabled={inCorso}>
          {inCorso ? 'Salvataggio…' : 'Salva le modifiche'}
        </button>

        {stato.conferma && <Conferma domanda={stato.conferma} inCorso={inCorso} />}
      </form>
    </>
  );
}

interface StatoAnnullamento {
  conferma: Domanda | null;
  avviso: string | null;
}

const FERMO: StatoAnnullamento = { conferma: null, avviso: null };

function Annullamento({ attivita }: { attivita: AttivitaConId }) {
  const [stato, invia, inCorso] = useActionState(
    async (_prima: StatoAnnullamento, dati: FormData): Promise<StatoAnnullamento> => {
      const passo = dati.get('passo');
      if (passo === 'indietro') return FERMO;
      if (passo === 'chiedi') {
        return { conferma: { testo: 'Annullare l’attività? Non si può tornare indietro.' }, avviso: null };
      }

      try {
        const avviso = avvisoAnnullamento(await annulla(attivita.id));
        if (avviso === null) vai(`/attivita/${attivita.id}`);
        return { conferma: null, avviso };
      } catch {
        return { conferma: null, avviso: SERVIZIO };
      }
    },
    FERMO,
  );

  return (
    <form className="pericolo" action={invia}>
      <h3>Annullare l’attività</h3>
      <p>Chi è iscritto o in lista d’attesa non potrà più partecipare. L’attività resta visibile, segnata come annullata.</p>

      {stato.avviso && (
        <p className="errore" role="alert">
          {stato.avviso}
        </p>
      )}

      <button type="submit" name="passo" value="chiedi" className="secondario" disabled={inCorso}>
        Annulla l’attività
      </button>

      {stato.conferma && <Conferma domanda={stato.conferma} inCorso={inCorso} />}
    </form>
  );
}

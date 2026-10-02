import { useActionState } from 'react';
import { ErroreApi } from '../api';
import { iscrivi, lascia, riconferma } from '../azioni';
import { useMioStato, useSospese, type AttivitaConId } from '../dati';
import { useUtente } from '../sessione';
import { metti, togli, type AzioneSospesa } from '../sospese';
import { avvisoIscrizione, avvisoRiconferma, avvisoUscita, descriviIscrizione, SOSPESA } from '../testi';

export function Iscrizione({ attivita, adesso }: { attivita: AttivitaConId; adesso: number }) {
  const utente = useUtente();
  const { stato, errore } = useMioStato(attivita, utente.uid);
  const sospesa = useSospese(utente.uid).find((s) => s.idAttivita === attivita.id);

  // Lo stato di chi chiede: posizione e motivo li conosce solo l'API
  const [avviso, invia, inCorso] = useActionState(async (_prima: string | null, dati: FormData) => {
    const azione = dati.get('azione');
    try {
      if (azione === 'ritira') {
        await togli(attivita.id);
        return null;
      }
      if (azione === 'iscrivi') return avvisoIscrizione(await iscrivi(attivita.id, attivita.versione));
      if (azione === 'riconferma') return avvisoRiconferma(await riconferma(attivita.id));
      return avvisoUscita(await lascia(attivita.id));
    } catch (e) {
      // Un errore che non è la rete non si accoda
      if (!(e instanceof ErroreApi && e.codice === 'api_irraggiungibile')) {
        return 'Qualcosa non ha funzionato. Riprova fra poco.';
      }

      // Senza rete la richiesta va in coda
      try {
        await metti({
          idAttivita: attivita.id,
          uid: utente.uid,
          azione: azione as AzioneSospesa,
          versioneVista: attivita.versione,
          titolo: attivita.titolo,
          creataIl: Date.now(),
        });
        return null;
      } catch {
        return 'Il servizio non risponde, e su questo dispositivo la richiesta non si può conservare.';
      }
    }
  }, null);

  if (attivita.stato === 'annullata') return <p className="stato">L’attività è stata annullata.</p>;
  if (attivita.inizio <= adesso) {
    return <p className="stato">L’attività è già cominciata: le iscrizioni sono chiuse.</p>;
  }
  if (attivita.organizzatore === utente.uid) {
    return <p className="stato">Organizzi questa attività: un posto è tuo.</p>;
  }
  // richiesta in coda
  if (sospesa) {
    return (
      <form className="stato sospesa" action={invia}>
        <p role="status">{SOSPESA[sospesa.azione]}</p>
        <div className="bottoni">
          <button type="submit" name="azione" value="ritira" className="secondario" disabled={inCorso}>
            Ritira la richiesta
          </button>
        </div>
        {avviso && (
          <p className="errore" role="alert">
            {avviso}
          </p>
        )}
      </form>
    );
  }
  if (!stato) {
    return (
      <p className="stato">
        {errore ? 'Non è stato possibile leggere la tua iscrizione.' : 'Lettura della tua iscrizione…'}
      </p>
    );
  }

  const { testo, bottoni } = descriviIscrizione(stato, attivita, adesso);

  return (
    <form className="stato" action={invia}>
      <p role="status">{testo}</p>
      <div className="bottoni">
        {bottoni.map((b, i) => (
          <button
            key={b.azione}
            type="submit"
            name="azione"
            value={b.azione}
            className={i > 0 ? 'secondario' : undefined}
            disabled={inCorso}
          >
            {b.testo}
          </button>
        ))}
      </div>
      {avviso && (
        <p className="errore" role="alert">
          {avviso}
        </p>
      )}
    </form>
  );
}

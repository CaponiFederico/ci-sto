import { useActionState } from 'react';
import { iscrivi, lascia } from '../azioni';
import { useMioStato, type AttivitaConId } from '../dati';
import { useUtente } from '../sessione';
import { avvisoIscrizione, avvisoUscita, descriviIscrizione } from '../testi';

export function Iscrizione({ attivita, adesso }: { attivita: AttivitaConId; adesso: number }) {
  const utente = useUtente();
  const { stato, errore } = useMioStato(attivita);

  // Lo stato di chi chiede: posizione e motivo li conosce solo l'API
  const [avviso, invia, inCorso] = useActionState(async (_prima: string | null, dati: FormData) => {
    try {
      return dati.get('azione') === 'iscrivi'
        ? avvisoIscrizione(await iscrivi(attivita.id))
        : avvisoUscita(await lascia(attivita.id));
    } catch {
      return 'Il servizio non risponde. Riprova fra poco.';
    }
  }, null);

  if (attivita.stato === 'annullata') return <p className="stato">L’attività è stata annullata.</p>;
  if (attivita.inizio <= adesso) {
    return <p className="stato">L’attività è già cominciata: le iscrizioni sono chiuse.</p>;
  }
  if (attivita.organizzatore === utente.uid) {
    return <p className="stato">Organizzi questa attività: un posto è tuo.</p>;
  }
  if (!stato) {
    return (
      <p className="stato">
        {errore ? 'Non è stato possibile leggere la tua iscrizione.' : 'Lettura della tua iscrizione…'}
      </p>
    );
  }

  const { testo, azione, bottone } = descriviIscrizione(stato, attivita, adesso);

  return (
    <form className="stato" action={invia}>
      <p>{testo}</p>
      <button type="submit" name="azione" value={azione} disabled={inCorso}>
        {inCorso ? 'Un momento…' : bottone}
      </button>
      {avviso && (
        <p className="errore" role="alert">
          {avviso}
        </p>
      )}
    </form>
  );
}

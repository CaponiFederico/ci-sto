import { useState } from 'react';
import { Iscrizione } from '../componenti/Iscrizione';
import { Nome } from '../componenti/Nome';
import { Salvati } from '../componenti/Salvati';
import { useAttivita, useCronologia, usePartecipanti, type AttivitaConId } from '../dati';
import { useUtente } from '../sessione';
import { CATEGORIA, POLITICA, posti, quando, voceCronologia } from '../testi';

export function Dettaglio({ id }: { id: string }) {
  const { attivita, errore, daCache } = useAttivita(id);

  return (
    <>
      <p className="ritorno">
        <a href="#/">← Bacheca</a> {daCache && <Salvati />}
      </p>

      {errore ? (
        <p className="errore" role="alert">
          Non è stato possibile leggere l’attività. Riprova fra poco.
        </p>
      ) : attivita === undefined ? (
        <p className="vuoto">Caricamento…</p>
      ) : attivita === null ? (
        <p className="vuoto">Questa attività non esiste.</p>
      ) : (
        <Contenuto attivita={attivita} />
      )}
    </>
  );
}

//  i dati di un'attività, la lista dei partecipanti e la cronologia degli eventi
function Contenuto({ attivita }: { attivita: AttivitaConId }) {
  const utente = useUtente();
  const partecipanti = usePartecipanti(attivita.id);
  const eventi = useCronologia(attivita.id);
  const [adesso] = useState(Date.now);

  const organizzatore = attivita.organizzatore === utente.uid;
  const annullata = attivita.stato === 'annullata';
  const cominciata = attivita.inizio <= adesso;
  const politica = POLITICA[attivita.politicaCoda];

  // Prima chi organizza
  const conPosto = [...partecipanti].sort(
    (a, b) =>
      Number(b.uid === attivita.organizzatore) - Number(a.uid === attivita.organizzatore) ||
      (a.confermatoIl ?? a.iscrittoIl) - (b.confermatoIl ?? b.iscrittoIl),
  );

  return (
    <article className="dettaglio">
      <div className="barra">
        <h2>{attivita.titolo}</h2>
        {organizzatore && !annullata && !cominciata && (
          <a href={`#/attivita/${attivita.id}/modifica`}>Modifica</a>
        )}
      </div>

      <p className="etichette">
        <span className="etichetta">{CATEGORIA[attivita.categoria]}</span>
        {organizzatore && <span className="etichetta">Organizzata da te</span>}
        {annullata && <span className="etichetta">Annullata</span>}
        {!annullata && cominciata && <span className="etichetta">Già cominciata</span>}
      </p>

      {attivita.descrizione && <p className="descrizione">{attivita.descrizione}</p>}

      <dl>
        <dt>Quando</dt>
        <dd>
          <time dateTime={new Date(attivita.inizio).toISOString()}>{quando(attivita.inizio)}</time>
          {', '}
          {attivita.durataMinuti} minuti
        </dd>

        <dt>Dove</dt>
        <dd>{attivita.luogo.testo}</dd>

        <dt>Organizza</dt>
        <dd>
          <Nome uid={attivita.organizzatore} />
        </dd>

        <dt>Posti</dt>
        <dd>
          {posti(attivita)}
          {attivita.daConfermare > 0 && `, ${attivita.daConfermare} da riconfermare`}
        </dd>

        <dt>Lista d’attesa</dt>
        <dd>
          {politica.nome}: a posti finiti entra per primo {politica.regola}
        </dd>
      </dl>

      <Iscrizione attivita={attivita} adesso={adesso} eventi={eventi} />

      <section>
        <h3>Chi partecipa</h3>
        <ul>
          {conPosto.map((p) => (
            <li key={p.uid}>
              <Nome uid={p.uid} />
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Cronologia</h3>
        <ul>
          {eventi.map((e) => (
            <li key={e.id}>
              <time dateTime={new Date(e.quando).toISOString()}>{quando(e.quando)}</time>
              {' · '}
              {voceCronologia(e)}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}

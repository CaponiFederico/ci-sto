import { onAuthStateChanged, type User } from 'firebase/auth';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { ErroreApi } from './api';
import { accediConGoogle, accediConPassword, apriSessione, esci, sessioneRicordata } from './auth';
import { ContestoNotifiche, useGestisciNotifiche } from './stato-notifiche';
import { Conferma, type Domanda } from './componenti/Conferma';
import { Notifiche } from './componenti/Notifiche';
import { FILTRI_INIZIALI } from './filtri';
import { inviaSospese } from './invio';
import { useSospese } from './dati';
import { auth } from './firebase';
import { Dettaglio } from './pagine/Dettaglio';
import { Elenco } from './pagine/Elenco';
import { Modifica } from './pagine/Modifica';
import { Nuova } from './pagine/Nuova';
import { rotta, usePercorso, type Rotta } from './percorso';
import { ContestoPosizione, useRilevaPosizione } from './posizione';
import { applicaAggiornamento, useNuovaVersione } from './pwa';
import { useOnline } from './rete';
import { ContestoUtente } from './sessione';
import { togli } from './sospese';
import { domandaUscita, inSospeso } from './testi';

function messaggio(errore: unknown) {
  if (errore instanceof ErroreApi) {
    if (errore.codice === 'dominio_non_ammesso') {
      return 'Questo indirizzo non appartiene all’ateneo. Accedi con l’account universitario.';
    }
    if (errore.codice === 'api_irraggiungibile') {
      return 'Il servizio non risponde. Verifica che l’API sia avviata.';
    }
    if (errore.codice === 'email_non_verificata') {
      return 'L’indirizzo non risulta verificato.';
    }
    return 'Non è stato possibile aprire la sessione. Riprova.';
  }

  const codice = (errore as { code?: string }).code;
  if (codice === 'auth/popup-closed-by-user' || codice === 'auth/cancelled-popup-request') {
    return 'Accesso annullato.';
  }
  if (codice === 'auth/popup-blocked') {
    return 'Il browser ha bloccato la finestra di accesso.';
  }

  // Firebase non distingue password errata da utente inesistente: non rivela quali indirizzi esistono.
  if (codice === 'auth/invalid-credential' || codice === 'auth/invalid-email') {
    return 'Email o password non corretti.';
  }
  if (codice === 'auth/too-many-requests') {
    return 'Troppi tentativi. Riprova fra qualche minuto.';
  }
  if (codice === 'auth/network-request-failed') {
    return 'Per accedere serve la rete.';
  }
  return 'Accesso non riuscito. Riprova.';
}

const TITOLO: Record<Rotta['pagina'], string> = {
  elenco: 'Attività',
  nuova: 'Nuova attività',
  dettaglio: 'Dettaglio attività',
  modifica: 'Modifica attività',
  sconosciuta: 'Pagina non trovata',
};

// L'indirizzo decide la pagina
function Pagina() {
  const r = rotta(usePercorso());
  // I filtri arrivano da fuori: restano scelti anche dopo aver aperto un'attività ed essere tornati
  const [filtri, setFiltri] = useState(FILTRI_INIZIALI);

  switch (r.pagina) {
    case 'elenco':
      return <Elenco filtri={filtri} cambiaFiltri={setFiltri} />;
    case 'nuova':
      return <Nuova />;
    case 'dettaglio':
      // Dettaglio è un componente a parte: gli hook partono solo quando l'attività c'è
      return <Dettaglio key={r.id} id={r.id} />;
    case 'modifica':
      return <Modifica key={r.id} id={r.id} />;
    case 'sconosciuta':
      return (
        <p className="vuoto">
          Pagina non trovata. <a href="#/">Torna alla bacheca</a>
        </p>
      );
  }
}

// Vive solo a sessione aperta
function Dentro() {
  const posizione = useRilevaPosizione();

  return (
    <ContestoPosizione value={posizione}>
      <Pagina />
    </ContestoPosizione>
  );
}

// fa partire la coda e mostra che cosa è ancora aperto
function InSospeso({ uid, online }: { uid: string; online: boolean }) {
  const sospese = useSospese(uid);

  // All'apertura dell'app e ogni volta che il browser dice che la rete è tornata
  useEffect(() => {
    if (online) void inviaSospese(uid);
  }, [uid, online]);

  const inAttesa = sospese.filter((s) => !s.rifiuto);
  const rifiutate = sospese.filter((s) => s.rifiuto);

  return (
    <>
      {inAttesa.length > 0 && (
        <p className="offline" role="status">
          {inSospeso(inAttesa.length)}{' '}
          <button type="button" onClick={() => void inviaSospese(uid)}>
            Riprova ora
          </button>
        </p>
      )}

      {rifiutate.map((s) => (
        <p key={s.idAttivita} className="errore" role="alert">
          <a href={`#/attivita/${s.idAttivita}`}>{s.titolo}</a>: {s.rifiuto?.testo}{' '}
          {!s.rifiuto?.cambiata && (
            <button type="button" className="secondario" onClick={() => void togli(s.idAttivita)}>
              Ho capito
            </button>
          )}
        </p>
      ))}
    </>
  );
}

// Uscendo la coda si svuota
function Uscita({ uid }: { uid: string }) {
  const inAttesa = useSospese(uid).filter((s) => !s.rifiuto).length;

  const [domanda, azione, inCorso] = useActionState(async (_prima: Domanda | null, dati: FormData) => {
    const passo = dati.get('passo');
    if (passo === 'indietro') return null;
    if (passo === 'chiedi' && inAttesa > 0) return { testo: domandaUscita(inAttesa) };

    await esci();
    return null;
  }, null);

  return (
    <form action={azione}>
      <button type="submit" name="passo" value="chiedi" disabled={inCorso}>
        Esci
      </button>
      {domanda && <Conferma domanda={domanda} inCorso={inCorso} />}
    </form>
  );
}

function App() {
  const [utente, setUtente] = useState<User | null>(null);
  const [sessioneVerificata, setSessioneVerificata] = useState(false);
  const [accessoInCorso, setAccessoInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const online = useOnline();
  const nuovaVersione = useNuovaVersione();
  const notifiche = useGestisciNotifiche(utente?.uid ?? null);
  const percorso = usePercorso();
  const pagina = rotta(percorso).pagina;
  const contenuto = useRef<HTMLElement>(null);
  const percorsoPrima = useRef(percorso);

  useEffect(() => {
    document.title = utente ? `${TITOLO[pagina]} · Bacheca` : 'Bacheca universitaria';
  }, [utente, pagina]);

  useEffect(() => {
    if (percorsoPrima.current === percorso) return;
    percorsoPrima.current = percorso;
    contenuto.current?.focus({ preventScroll: true });
  }, [percorso]);

  const vaiAlContenuto = () => contenuto.current?.focus();

  // Vale sia per l'accesso appena fatto sia per la sessione ripresa al ricaricamento.
  useEffect(
    () =>
      onAuthStateChanged(auth, async (u) => {
        if (!u) {
          setUtente(null);
          setSessioneVerificata(true);
          return;
        }

        try {
          await apriSessione();
          setUtente(u);
        } catch (e) {
          // Se l'utente non ha più accesso, non mostra l'errore ma esce
          const rifiutato = e instanceof ErroreApi && (e.stato === 401 || e.stato === 403);
          if (!rifiutato && sessioneRicordata(u.uid)) {
            setUtente(u);
          } else {
            setErrore(messaggio(e));
            await esci();
          }
        } finally {
          setSessioneVerificata(true);
        }
      }),
    [],
  );

  async function accedi(operazione: () => Promise<unknown>) {
    setErrore(null);
    setAccessoInCorso(true);
    try {
      await operazione();
    } catch (e) {
      setErrore(messaggio(e));
    } finally {
      setAccessoInCorso(false);
    }
  }

  function inviaCredenziali(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dati = new FormData(evento.currentTarget);
    void accedi(() =>
      accediConPassword(String(dati.get('email')), String(dati.get('password'))),
    );
  }

  return (
    <ContestoNotifiche value={notifiche}>
      <button type="button" className="salta" onClick={vaiAlContenuto}>
        Vai al contenuto
      </button>

      <header>
        <h1>
          <a href="#/">Bacheca</a>
        </h1>
        <p className="sottotitolo">Attività fra studenti</p>

        <div className="sessione">
          {!sessioneVerificata ? (
            <span>Verifica della sessione…</span>
          ) : utente ? (
            <>
              <span>{utente.email}</span>
              <Uscita uid={utente.uid} />
            </>
          ) : (
            <button
              type="button"
              onClick={() => void accedi(accediConGoogle)}
              disabled={accessoInCorso}
            >
              {accessoInCorso ? 'Accesso in corso…' : 'Accedi con Google'}
            </button>
          )}
        </div>

        {sessioneVerificata && !utente && (
          <details className="credenziali">
            <summary>Accedi con email e password</summary>

            <form onSubmit={inviaCredenziali}>
              <label>
                Email
                <input type="email" name="email" required autoComplete="username" />
              </label>
              <label>
                Password
                <input
                  type="password"
                  name="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" disabled={accessoInCorso}>
                Accedi
              </button>
            </form>
          </details>
        )}

        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}

        {!online && (
          <p className="offline" role="status">
            Sei offline: vedi i dati salvati su questo dispositivo.
          </p>
        )}

        {nuovaVersione && (
          <p className="offline" role="status">
            È disponibile una nuova versione.{' '}
            <button type="button" onClick={applicaAggiornamento}>
              Aggiorna
            </button>
          </p>
        )}

        {utente && <Notifiche />}
        {utente && <InSospeso uid={utente.uid} online={online} />}
      </header>

      <main ref={contenuto} tabIndex={-1}>
        {utente ? (
          <ContestoUtente value={utente}>
            <Dentro />
          </ContestoUtente>
        ) : (
          sessioneVerificata && (
            <p className="vuoto">Accedi con l’account di ateneo per vedere la bacheca.</p>
          )
        )}
      </main>
    </ContestoNotifiche>
  );
}

export default App;

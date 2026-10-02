import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState, type FormEvent } from 'react';
import { ErroreApi } from './api';
import { accediConGoogle, accediConPassword, apriSessione, esci } from './auth';
import { auth } from './firebase';
import { Dettaglio } from './pagine/Dettaglio';
import { Elenco } from './pagine/Elenco';
import { Modifica } from './pagine/Modifica';
import { Nuova } from './pagine/Nuova';
import { rotta, usePercorso } from './percorso';
import { ContestoUtente } from './sessione';

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
  return 'Accesso non riuscito. Riprova.';
}

// L'indirizzo decide la pagina
function Pagina() {
  const r = rotta(usePercorso());

  switch (r.pagina) {
    case 'elenco':
      return <Elenco />;
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

function App() {
  const [utente, setUtente] = useState<User | null>(null);
  const [sessioneVerificata, setSessioneVerificata] = useState(false);
  const [accessoInCorso, setAccessoInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

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
          setErrore(messaggio(e));
          await esci();
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
    <>
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
              <button type="button" onClick={() => void esci()}>
                Esci
              </button>
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
      </header>

      <main>
        {utente ? (
          <ContestoUtente value={utente}>
            <Pagina />
          </ContestoUtente>
        ) : (
          sessioneVerificata && (
            <p className="vuoto">Accedi con l’account di ateneo per vedere la bacheca.</p>
          )
        )}
      </main>
    </>
  );
}

export default App;

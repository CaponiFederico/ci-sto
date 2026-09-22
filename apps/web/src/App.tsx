import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { accediConGoogle, esci } from './auth';
import { auth } from './firebase';

function App() {
  const [utente, setUtente] = useState<User | null>(null);
  const [sessioneVerificata, setSessioneVerificata] = useState(false);
  const [accessoInCorso, setAccessoInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUtente(u);
        setSessioneVerificata(true);
      }),
    [],
  );

  async function accedi() {
    setErrore(null);
    setAccessoInCorso(true);
    try {
      await accediConGoogle();
    } catch (e) {
      const codice = (e as { code?: string }).code;
      setErrore(
        codice === 'auth/popup-closed-by-user' || codice === 'auth/cancelled-popup-request'
          ? 'Accesso annullato.'
          : codice === 'auth/popup-blocked'
            ? 'Il browser ha bloccato la finestra di accesso.'
            : 'Accesso non riuscito. Riprova.',
      );
    } finally {
      setAccessoInCorso(false);
    }
  }

  return (
    <>
      <header>
        <h1>Bacheca</h1>
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
            <button type="button" onClick={() => void accedi()} disabled={accessoInCorso}>
              {accessoInCorso ? 'Accesso in corso…' : 'Accedi con Google'}
            </button>
          )}
        </div>

        {errore && (
          <p className="errore" role="alert">
            {errore}
          </p>
        )}
      </header>

      <main>
        <p className="vuoto">Nessuna attività pubblicata.</p>
      </main>
    </>
  );
}

export default App;

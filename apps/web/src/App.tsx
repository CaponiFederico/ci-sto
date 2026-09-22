import { onAuthStateChanged, type User } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { auth } from './firebase';

function App() {
  const [utente, setUtente] = useState<User | null>(null);
  const [sessioneVerificata, setSessioneVerificata] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setUtente(u);
        setSessioneVerificata(true);
      }),
    [],
  );

  return (
    <>
      <header>
        <h1>Bacheca</h1>
        <p className="sottotitolo">Attività fra studenti</p>
        <p className="sessione">
          {!sessioneVerificata
            ? 'Verifica della sessione…'
            : utente
              ? utente.email
              : 'Non hai effettuato l’accesso'}
        </p>
      </header>

      <main>
        <p className="vuoto">Nessuna attività pubblicata.</p>
      </main>
    </>
  );
}

export default App;

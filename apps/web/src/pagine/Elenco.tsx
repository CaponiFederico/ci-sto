import { Scheda } from '../componenti/Scheda';
import { useElenco } from '../dati';

export function Elenco() {
  const { attivita, errore } = useElenco();

  return (
    <>
      <div className="barra">
        <h2>Attività</h2>
        <a className="bottone" href="#/nuova">
          Nuova attività
        </a>
      </div>

      {errore ? (
        <p className="errore" role="alert">
          Non è stato possibile leggere la bacheca. Riprova fra poco.
        </p>
      ) : attivita === null ? (
        <p className="vuoto">Caricamento…</p>
      ) : attivita.length === 0 ? (
        <p className="vuoto">Nessuna attività in programma.</p>
      ) : (
        <ul className="elenco">
          {attivita.map((a) => (
            <li key={a.id}>
              <Scheda attivita={a} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

import { RICERCA_LUOGO, type LuogoTrovato } from 'modello';
import { useState, type ReactNode } from 'react';
import { cercaLuoghi } from '../azioni';
import { MAPPA } from '../testi';

interface Proprieta {
  etichetta: string;
  domanda?: (scritto: string) => string;
  accanto?: ReactNode;
  aiuto?: string;
  scelto: (luogo: LuogoTrovato) => void;
}

export function Ricerca({ etichetta, domanda = (scritto) => scritto, accanto, aiuto, scelto }: Proprieta) {
  const [ricerca, setRicerca] = useState('');
  const [risultati, setRisultati] = useState<LuogoTrovato[] | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);

  async function cerca() {
    const q = domanda(ricerca.trim()).trim();
    setRisultati(null);
    if (q.length < RICERCA_LUOGO.minima) {
      setMessaggio(MAPPA.corta);
      return;
    }

    setInCorso(true);
    setMessaggio(null);
    try {
      const esito = await cercaLuoghi(q);
      if (esito.esito === 'non_disponibile') setMessaggio(MAPPA.nonDisponibile);
      else if (esito.luoghi.length === 0) setMessaggio(MAPPA.nessuno);
      else setRisultati(esito.luoghi);
    } catch {
      setMessaggio(MAPPA.nonDisponibile);
    } finally {
      setInCorso(false);
    }
  }

  return (
    <>
      <div className="cerca">
        <label>
          {etichetta}
          <input
            value={ricerca}
            maxLength={RICERCA_LUOGO.massima}
            onChange={(e) => setRicerca(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return;
              e.preventDefault();
              void cerca();
            }}
          />
        </label>
        {accanto}
        <button type="button" className="secondario" onClick={() => void cerca()} disabled={inCorso}>
          {inCorso ? 'Ricerca…' : 'Cerca sulla mappa'}
        </button>
      </div>

      {aiuto && <p className="nota">{aiuto}</p>}

      {messaggio && (
        <p className="nota" role="status">
          {messaggio}
        </p>
      )}

      {risultati && (
        <>
          <ul className="risultati">
            {risultati.map((l) => (
              <li key={`${l.lat},${l.lon}`}>
                <button
                  type="button"
                  className="secondario"
                  onClick={() => {
                    setRisultati(null);
                    scelto(l);
                  }}
                >
                  {l.nome}
                </button>
              </li>
            ))}
          </ul>
          <p className="nota">{MAPPA.attribuzione}</p>
        </>
      )}
    </>
  );
}

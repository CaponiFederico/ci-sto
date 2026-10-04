import { LUNGHEZZA_MASSIMA, RICERCA_LUOGO, type LuogoTrovato } from 'modello';
import { useRef, useState, type ReactNode } from 'react';
import { cercaLuoghi } from '../azioni';
import { puntoDi, type Valori } from '../modulo';
import { MAPPA } from '../testi';
import { Mappa } from './Mappa';

interface Proprieta {
  valori: Valori;
  sbagliato?: true;
  errore: ReactNode;
}

// Il luogo è il nome conosciuto
export function CampoLuogo({ valori, sbagliato, errore }: Proprieta) {
  const testo = useRef<HTMLInputElement>(null);
  const civico = useRef<HTMLInputElement>(null);
  const [punto, setPunto] = useState<LuogoTrovato | null>(() => puntoDi(valori));
  const [ricerca, setRicerca] = useState('');
  const [risultati, setRisultati] = useState<LuogoTrovato[] | null>(null);
  const [messaggio, setMessaggio] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState(false);
  const [rinominato, setRinominato] = useState(false);

  async function cerca() {
    // Senza un indirizzo si cerca il luogo 
    const dove = ricerca.trim() || (testo.current?.value.trim() ?? '');
    // Con il civico 
    const q = `${dove} ${civico.current?.value.trim() ?? ''}`.trim();
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

  function scegli(luogo: LuogoTrovato | null) {
    setPunto(luogo);
    setRisultati(null);
    setRinominato(false);
  }

  return (
    <>
      <label>
        Luogo
        <input
          ref={testo}
          name="luogo"
          aria-invalid={sbagliato}
          defaultValue={valori.luogo}
          required
          maxLength={LUNGHEZZA_MASSIMA.luogo}
          onChange={() => punto && setRinominato(true)}
        />
        <span className="nota">{MAPPA.aiutoLuogo}</span>
        {errore}
      </label>

      <div className="mappa">
        <div className="cerca">
          <label>
            Indirizzo
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
          <label className="civico">
            Civico
            <input
              ref={civico}
              name="luogoCivico"
              defaultValue={valori.luogoCivico}
              maxLength={LUNGHEZZA_MASSIMA.civico}
            />
          </label>
          <button type="button" className="secondario" onClick={() => void cerca()} disabled={inCorso}>
            {inCorso ? 'Ricerca…' : 'Cerca sulla mappa'}
          </button>
        </div>

        <p className="nota">{MAPPA.aiutoIndirizzo}</p>

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
                  <button type="button" className="secondario" onClick={() => scegli(l)}>
                    {l.nome}
                  </button>
                </li>
              ))}
            </ul>
            <p className="nota">{MAPPA.attribuzione}</p>
          </>
        )}

        {punto && (
          <p className="nota" role="status">
            Indirizzo scelto: <strong>{punto.nome}</strong>{' '}
            <button type="button" className="secondario" onClick={() => scegli(null)}>
              Togli
            </button>
            {rinominato && <> {MAPPA.rinominato}</>}
          </p>
        )}

        {punto && <Mappa {...punto} />}

        <input type="hidden" name="luogoNome" value={punto?.nome ?? ''} />
        <input type="hidden" name="luogoLat" value={punto?.lat ?? ''} />
        <input type="hidden" name="luogoLon" value={punto?.lon ?? ''} />
      </div>
    </>
  );
}

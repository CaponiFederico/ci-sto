import { LUNGHEZZA_MASSIMA, type LuogoTrovato } from 'modello';
import { useRef, useState, type ReactNode } from 'react';
import { puntoDi, type Valori } from '../modulo';
import { MAPPA } from '../testi';
import { Mappa } from './Mappa';
import { Ricerca } from './Ricerca';

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
  const [rinominato, setRinominato] = useState(false);

  function scegli(luogo: LuogoTrovato | null) {
    setPunto(luogo);
    setRinominato(false);
  }

  // Senza un indirizzo si cerca il luogo
  function domanda(scritto: string) {
    const dove = scritto || (testo.current?.value.trim() ?? '');
    return `${dove} ${civico.current?.value.trim() ?? ''}`;
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
        <Ricerca
          etichetta="Indirizzo"
          domanda={domanda}
          aiuto={MAPPA.aiutoIndirizzo}
          scelto={scegli}
          accanto={
            <label className="civico">
              Civico
              <input
                ref={civico}
                name="luogoCivico"
                defaultValue={valori.luogoCivico}
                maxLength={LUNGHEZZA_MASSIMA.civico}
              />
            </label>
          }
        />

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

import { LUNGHEZZA_MASSIMA, type LuogoTrovato } from 'modello';
import { useRef, useState, type ReactNode } from 'react';
import { indirizzoDi } from '../azioni';
import { puntoDi, type Valori } from '../modulo';
import { rileva } from '../posizione';
import { MAPPA, POSIZIONE } from '../testi';
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
  const [cercoQui, setCercoQui] = useState(false);
  // Compare solo se «Usa la mia posizione» non è riuscito
  const [erroreQui, setErroreQui] = useState<string | null>(null);

  function scegli(luogo: LuogoTrovato | null) {
    setPunto(luogo);
    setRinominato(false);
  }

  function sonoQui() {
    rileva(
      async ({ lat, lon }) => {
        try {
          const esito = await indirizzoDi(lat, lon);
          if (esito.esito === 'non_disponibile') setErroreQui(MAPPA.nonDisponibile);
          else if (esito.luoghi.length === 0) setErroreQui(MAPPA.quiNessuno);
          else scegli(esito.luoghi[0]);
        } catch {
          setErroreQui(MAPPA.nonDisponibile);
        } finally {
          setCercoQui(false);
        }
      },
      (stato) => {
        // Finché va tutto bene non si dice niente: lo mostra il bottone
        if (stato === 'in_corso' || stato === 'nota') {
          setCercoQui(true);
          setErroreQui(null);
          return;
        }
        setCercoQui(false);
        setErroreQui(stato === 'negata' ? MAPPA.quiNegata : POSIZIONE[stato]);
      },
    );
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

        <p className="nota">
          <button type="button" className="secondario" onClick={sonoQui} disabled={cercoQui}>
            {cercoQui ? MAPPA.quiInCorso : MAPPA.qui}
          </button>
        </p>

        {erroreQui && (
          <p className="errore" role="alert">
            {erroreQui}
          </p>
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

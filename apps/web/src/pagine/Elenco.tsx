import { CATEGORIE } from 'modello';
import { MiaPosizione } from '../componenti/MiaPosizione';
import { Salvati } from '../componenti/Salvati';
import { Scheda } from '../componenti/Scheda';
import {
  useElenco,
  useMieIscrizioni,
  useMieStatistiche,
  usePresenti,
  useScaricoAnticipato,
  useSospese,
} from '../dati';
import { filtra, FILTRI_INIZIALI, type Filtri } from '../filtri';
import { ordina, type Valutata } from '../ordine';
import { usePosizione } from '../posizione';
import { useUtente } from '../sessione';
import {
  CATEGORIA,
  MOSTRA,
  motivoOrdine,
  ORDINE,
  SENZA_POSIZIONE,
  SENZA_STORICO,
  VICINE,
  type StatoSospesa,
} from '../testi';

interface Proprieta {
  filtri: Filtri;
  cambiaFiltri: (filtri: Filtri) => void;
}

export function Elenco({ filtri, cambiaFiltri }: Proprieta) {
  const utente = useUtente();
  const { attivita: lette, errore, daCache, adesso } = useElenco();
  const ids = lette?.map((a) => a.id) ?? [];
  const stati = useMieIscrizioni(ids, utente.uid);
  const statistiche = useMieStatistiche(utente.uid);
  const presenti = usePresenti(ids);

  // Un'attività già cominciata resta in elenco solo per chi partecipa
  const attivita = lette?.filter((a) => a.inizio > adesso || stati[a.id] !== undefined) ?? null;
  useScaricoAnticipato((lette ?? []).filter((a) => stati[a.id] !== undefined).map((a) => a.id));
  const sospese = useSospese(utente.uid);

  function sospesaDi(id: string): StatoSospesa | undefined {
    const trovata = sospese.find((s) => s.idAttivita === id);
    if (!trovata) return undefined;
    if (!trovata.rifiuto) return 'attesa';
    return trovata.rifiuto.cambiata ? 'cambiata' : 'rifiutata';
  }

  const posizione = usePosizione();
  const vicine = filtri.mostra === 'vicine';
  const visibili = attivita ? filtra(attivita, filtri, utente.uid, stati, adesso, posizione.punto) : [];
  // L'ordine è calcolato qui, sui documenti già scaricati
  // senza storico coincide con quello per data
  const personale = filtri.ordine === 'per_te';
  const ordinate: Pick<Valutata, 'attivita' | 'motivo'>[] = personale
    ? ordina(visibili, statistiche ?? null, presenti, utente.uid, adesso, posizione.punto)
    : visibili.map((a) => ({ attivita: a, motivo: null }));
  // Chi non ha mai partecipato vede l'ordine per data
  const senzaStorico = personale && statistiche !== undefined && (statistiche?.partecipazioni ?? 0) === 0;
  const senzaPosizione = personale && !posizione.punto && visibili.some((a) => a.luogo.lat !== undefined);
  const filtrato = filtri.categoria !== 'tutte' || filtri.mostra !== 'tutte';

  return (
    <>
      <div className="barra">
        <h2>Attività {daCache && <Salvati />}</h2>
        <a className="bottone" href="#/nuova">
          Nuova attività
        </a>
      </div>

      <div className="colonne">
        <div className="lato">
          <div className="filtri">
            <label>
              Categoria
              <select
                value={filtri.categoria}
                onChange={(e) => cambiaFiltri({ ...filtri, categoria: e.target.value as Filtri['categoria'] })}
              >
                <option value="tutte">Tutte</option>
                {CATEGORIE.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA[c]}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Mostra
              <select
                value={filtri.mostra}
                onChange={(e) => {
                  const mostra = e.target.value as Filtri['mostra'];
                  if (mostra === 'vicine' && posizione.stato === 'ignota') posizione.chiedi();
                  cambiaFiltri({ ...filtri, mostra });
                }}
              >
                {Object.entries(MOSTRA).map(([valore, etichetta]) => (
                  <option key={valore} value={valore}>
                    {etichetta}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ordina
              <select
                value={filtri.ordine}
                onChange={(e) => cambiaFiltri({ ...filtri, ordine: e.target.value as Filtri['ordine'] })}
              >
                {Object.entries(ORDINE).map(([valore, etichetta]) => (
                  <option key={valore} value={valore}>
                    {etichetta}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <MiaPosizione aperta={vicine && !posizione.punto} />
          {vicine && (
            <p className="nota" role="status">
              {posizione.punto ? VICINE.nota : VICINE.senza}
            </p>
          )}
          {filtrato && visibili.length > 0 && (
            <p className="nota">
              {visibili.length} su {attivita?.length}
            </p>
          )}
          {senzaStorico && visibili.length > 0 && <p className="nota">{SENZA_STORICO}</p>}
          {senzaPosizione && <p className="nota">{SENZA_POSIZIONE}</p>}
        </div>

        <div>
          {errore ? (
            <p className="errore" role="alert">
              Non è stato possibile leggere la bacheca. Riprova fra poco.
            </p>
          ) : attivita === null ? (
            <p className="vuoto">Caricamento…</p>
          ) : attivita.length === 0 ? (
            <p className="vuoto">Nessuna attività in programma.</p>
          ) : visibili.length === 0 ? (
            <p className="vuoto">
              Nessuna attività con questi filtri.{' '}
              <button type="button" className="secondario" onClick={() => cambiaFiltri({ ...FILTRI_INIZIALI, ordine: filtri.ordine })}>
                Togli i filtri
              </button>
            </p>
          ) : (
            <ul className="elenco">
              {ordinate.map(({ attivita: a, motivo }) => (
                <li key={a.id}>
                  <Scheda
                    attivita={a}
                    mioStato={stati[a.id]}
                    sospesa={sospesaDi(a.id)}
                    cominciata={a.inizio <= adesso}
                    motivo={motivo ? motivoOrdine(motivo) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

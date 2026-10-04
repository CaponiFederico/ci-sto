import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  CATEGORIE,
  DURATA_MASSIMA,
  DURATA_MINIMA,
  LUNGHEZZA_MASSIMA,
  POLITICHE,
  type PoliticaCoda,
} from 'modello';
import type { Campo, Valori } from '../modulo';
import { CATEGORIA, ERRORE_CAMPO, POLITICA } from '../testi';
import { CampoLuogo } from './Luogo';

// Campi di un modulo di creazione o modifica di un evento
interface Proprieta {
  valori: Valori;
  errori: string[];
  // La politica si cambia solo a lista d'attesa vuota
  politicaBloccata?: boolean;
}

export function Campi({ valori, errori, politicaBloccata = false }: Proprieta) {
  const errore = (campo: Campo) =>
    errori.includes(campo) && <span className="errore-campo">{ERRORE_CAMPO[campo]}</span>;
  const sbagliato = (campo: Campo) => errori.includes(campo) || undefined;

  return (
    <>
      <label>
        Titolo
        <input name="titolo" aria-invalid={sbagliato('titolo')} defaultValue={valori.titolo} required maxLength={LUNGHEZZA_MASSIMA.titolo} />
        {errore('titolo')}
      </label>

      <label>
        Descrizione
        <textarea
          name="descrizione"
          aria-invalid={sbagliato('descrizione')}
          defaultValue={valori.descrizione}
          rows={3}
          maxLength={LUNGHEZZA_MASSIMA.descrizione}
        />
        {errore('descrizione')}
      </label>

      <label>
        Categoria
        <select key={valori.categoria} name="categoria" defaultValue={valori.categoria}>
          {CATEGORIE.map((c) => (
            <option key={c} value={c}>
              {CATEGORIA[c]}
            </option>
          ))}
        </select>
        {errore('categoria')}
      </label>

      <div className="affiancati">
        <label>
          Inizio
          <input type="datetime-local" name="inizio" aria-invalid={sbagliato('inizio')} defaultValue={valori.inizio} required />
          {errore('inizio')}
        </label>

        <label>
          Durata in minuti
          <input
            type="number"
            name="durataMinuti"
          aria-invalid={sbagliato('durataMinuti')}
            defaultValue={valori.durataMinuti}
            required
            min={DURATA_MINIMA}
            max={DURATA_MASSIMA}
          />
          {errore('durataMinuti')}
        </label>
      </div>

      <CampoLuogo valori={valori} sbagliato={sbagliato('luogo')} errore={errore('luogo')} />

      <label>
        Posti, te compreso
        <input
          type="number"
          name="capacita"
          aria-invalid={sbagliato('capacita')}
          defaultValue={valori.capacita}
          required
          min={CAPACITA_MINIMA}
          max={CAPACITA_MASSIMA}
        />
        {errore('capacita')}
      </label>

      {politicaBloccata && (
        <p className="nota">
          <input type="hidden" name="politicaCoda" value={valori.politicaCoda} />
          Lista d’attesa: <strong>{POLITICA[valori.politicaCoda as PoliticaCoda].nome}</strong>. C’è qualcuno
          in lista: la regola si può cambiare solo quando è vuota.
        </p>
      )}

      <fieldset hidden={politicaBloccata} disabled={politicaBloccata}>
        <legend>A posti finiti, chi entra per primo dalla lista d’attesa</legend>
        {POLITICHE.map((p) => (
          <label key={p} className="scelta">
            <input type="radio" name="politicaCoda" value={p} defaultChecked={valori.politicaCoda === p} />
            <span>
              <strong>{POLITICA[p].nome}</strong>: {POLITICA[p].regola}
            </span>
          </label>
        ))}
        {errore('politicaCoda')}
      </fieldset>
    </>
  );
}

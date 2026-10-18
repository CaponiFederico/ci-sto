import { usePosizione } from '../posizione';
import { MIA_POSIZIONE, POSIZIONE } from '../testi';
import { Ricerca } from './Ricerca';

// Da dove si calcolano le distanze
export function MiaPosizione() {
  //indirizzo scelto a mano >>> dispositivo
  const { aMano, stato, chiedi, scegli } = usePosizione();

  return (
    <div className="posizione">
      <p className="nota">{MIA_POSIZIONE.aCosaServe}</p>

      {aMano ? (
        <p role="status">
          Indirizzo scelto: <strong>{aMano.nome}</strong>{' '}
          <button type="button" className="secondario" onClick={() => scegli(null)}>
            Togli
          </button>
        </p>
      ) : stato === 'ignota' ? (
        <button type="button" className="secondario" onClick={chiedi}>
          {MIA_POSIZIONE.usa}
        </button>
      ) : (
        <p role="status">{stato === 'nota' ? MIA_POSIZIONE.dalDispositivo : POSIZIONE[stato]}</p>
      )}

      <Ricerca etichetta={aMano ? MIA_POSIZIONE.cambia : MIA_POSIZIONE.etichetta} scelto={scegli} />
    </div>
  );
}

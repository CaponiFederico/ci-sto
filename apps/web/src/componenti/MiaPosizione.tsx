import { usePosizione } from '../posizione';
import { MIA_POSIZIONE, POSIZIONE } from '../testi';
import { Ricerca } from './Ricerca';

// il dispositivo oun indirizzo scelto a mano
export function MiaPosizione({ aperta }: { aperta: boolean }) {
  const { aMano, stato, chiedi, scegli } = usePosizione();
  const riassunto = aMano ? MIA_POSIZIONE.scelta : stato === 'nota' ? MIA_POSIZIONE.rilevata : MIA_POSIZIONE.assente;

  return (
    <details className="posizione" open={aperta || undefined}>
      <summary>
        {MIA_POSIZIONE.titolo}: {riassunto}
      </summary>

      <p className="nota">{MIA_POSIZIONE.aCosaServe}</p>

      {aMano ? (
        <p className="nota" role="status">
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
        <p className="nota" role="status">
          {stato === 'nota' ? MIA_POSIZIONE.dalDispositivo : POSIZIONE[stato]}
        </p>
      )}

      <details className="a-mano" open={aMano !== null || stato === 'negata' || stato === 'non_disponibile' || undefined}>
        <summary>{MIA_POSIZIONE.aMano}</summary>
        <Ricerca etichetta={MIA_POSIZIONE.etichetta} scelto={scegli} />
      </details>
    </details>
  );
}

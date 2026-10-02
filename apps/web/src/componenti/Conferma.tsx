import { useEffect, useRef } from 'react';

export interface Domanda {
  testo: string;
}

// Va dentro un <form>
export function Conferma({ domanda, inCorso }: { domanda: Domanda; inCorso: boolean }) {
  const finestra = useRef<HTMLDialogElement>(null);

  // showModal blocca il resto della pagina
  useEffect(() => {
    if (!finestra.current?.open) finestra.current?.showModal();
  }, [domanda]);

  return (
    <dialog ref={finestra}>
      <p>{domanda.testo}</p>
      <div className="bottoni">
        <button type="submit" name="passo" value="conferma" disabled={inCorso}>
          {inCorso ? 'Un momento…' : 'Conferma'}
        </button>
        <button type="submit" name="passo" value="indietro" className="secondario" disabled={inCorso}>
          Torna indietro
        </button>
      </div>
    </dialog>
  );
}

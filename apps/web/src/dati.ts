import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { COLLEZIONI, type Attivita } from 'modello';
import { useEffect, useState } from 'react';
import { db } from './firebase';

// L'id non è nei dati del documento
export type AttivitaConId = Attivita & { id: string };

// attività per data
export function useElenco() {
  const [attivita, setAttivita] = useState<AttivitaConId[] | null>(null);
  const [errore, setErrore] = useState(false);

  const [adesso] = useState(Date.now);

  useEffect(() => {
    const prossime = query(
      collection(db, COLLEZIONI.attivita),
      where('inizio', '>=', adesso),
      orderBy('inizio'),
    );

    // onSnapshot legge i dati e aggiorna in tempo reale
    // Restituisce una funzione per annullare l'iscrizione
    return onSnapshot(
      prossime,
      (risultato) => {
        setAttivita(risultato.docs.map((d) => ({ id: d.id, ...(d.data() as Attivita) })));
        setErrore(false);
      },
      () => setErrore(true),
    );
  }, [adesso]);

  return { attivita, errore };
}

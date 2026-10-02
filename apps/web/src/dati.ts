import { collection, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type Evento,
  type Partecipante,
  type StatoIscrizione,
  type Utente,
} from 'modello';
import { useEffect, useState } from 'react';
import { statoIscrizione } from './azioni';
import type { MieiStati } from './filtri';
import { db } from './firebase';

// L'id non è nei dati del documento
export type AttivitaConId = Attivita & { id: string };
export type PartecipanteConUid = Partecipante & { uid: string };
export type EventoConId = Evento & { id: string };

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

// Il mio stato in ciascuna attività dell'elenco
export function useMieIscrizioni(ids: string[], uid: string) {
  const [stati, setStati] = useState<MieiStati>({});

  const chiave = ids.join(',');

  useEffect(() => {
    const chiusure = chiave
      .split(',')
      .filter(Boolean)
      .map((id) =>
        onSnapshot(doc(db, COLLEZIONI.attivita, id, SOTTOCOLLEZIONI.partecipanti, uid), (d) => {
          const stato = d.exists() ? (d.data() as Partecipante).stato : undefined;
          // Le risposte arrivano una alla volta: ognuna parte dallo stato precedente.
          setStati((prima) => ({ ...prima, [id]: stato }));
        }),
      );
    return () => chiusure.forEach((chiudi) => chiudi());
  }, [chiave, uid]);

  return stati;
}

// Una sola attività: undefined finché non arriva, null se non esiste
export function useAttivita(id: string) {
  const [attivita, setAttivita] = useState<AttivitaConId | null | undefined>(undefined);
  const [errore, setErrore] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLEZIONI.attivita, id),
        (d) => {
          setAttivita(d.exists() ? { id: d.id, ...(d.data() as Attivita) } : null);
          setErrore(false);
        },
        () => setErrore(true),
      ),
    [id],
  );

  return { attivita, errore };
}

// Chi ha un posto, anche se da confermare
// Chi è in lista non si elenca
export function usePartecipanti(id: string) {
  const [partecipanti, setPartecipanti] = useState<PartecipanteConUid[]>([]);

  useEffect(() => {
    const conPosto = query(
      collection(db, COLLEZIONI.attivita, id, SOTTOCOLLEZIONI.partecipanti),
      where('stato', 'in', ['confermato', 'da_confermare']),
    );
    return onSnapshot(conPosto, (risultato) =>
      setPartecipanti(risultato.docs.map((d) => ({ uid: d.id, ...(d.data() as Partecipante) }))),
    );
  }, [id]);

  return partecipanti;
}

// Il proprio stato lo dice l'API. Si richiede a ogni cambiamento dell'attività.
export function useMioStato(attivita: AttivitaConId) {
  const [stato, setStato] = useState<StatoIscrizione | null>(null);
  const [errore, setErrore] = useState(false);

  useEffect(() => {
    let attuale = true;
    statoIscrizione(attivita.id)
      .then((letto) => {
        if (!attuale) return;
        setStato(letto);
        setErrore(false);
      })
      .catch(() => attuale && setErrore(true));

    // Una risposta arrivata tardi non deve sovrascrivere quella più recente
    return () => {
      attuale = false;
    };
  }, [attivita]);

  return { stato, errore };
}

export function useCronologia(id: string) {
  const [eventi, setEventi] = useState<EventoConId[]>([]);

  useEffect(() => {
    const dellAttivita = query(
      collection(db, COLLEZIONI.attivita, id, SOTTOCOLLEZIONI.eventi),
      where('tipo', 'in', ['creata', 'modificata', 'annullata']),
    );
    return onSnapshot(dellAttivita, (risultato) => {
      const letti = risultato.docs.map((d) => ({ id: d.id, ...(d.data() as Evento) }));
      setEventi(letti.sort((a, b) => a.versione - b.versione));
    });
  }, [id]);

  return eventi;
}

// Legge il nome di un utente
// Se non c'è restituisce l'email senza dominio
// Se non c'è restituisce "Utente"
const nomi = new Map<string, Promise<string>>();

export function leggiNome(uid: string) {
  let nome = nomi.get(uid);
  if (!nome) {
    nome = getDoc(doc(db, COLLEZIONI.utenti, uid))
      .then((d) => {
        const utente = d.data() as Partial<Utente> | undefined;
        return utente?.nome ?? utente?.email?.split('@')[0] ?? 'Utente';
      })
      // Anche l'errore resta in memoria
      .catch(() => 'Utente');
    nomi.set(uid, nome);
  }
  return nome;
}

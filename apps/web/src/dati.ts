import { collection, doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type Evento,
  type Partecipante,
  type Utente,
} from 'modello';
import { useEffect, useState } from 'react';
import { statoIscrizione } from './azioni';
import type { MieiStati } from './filtri';
import { db } from './firebase';
import { ascolta, tutte, type Sospesa } from './sospese';

// L'id non è nei dati del documento
export type AttivitaConId = Attivita & { id: string };
export type PartecipanteConUid = Partecipante & { uid: string };
export type EventoConId = Evento & { id: string };

// Il mio stato in un'attività
// La posizione in lista la sa solo l'API: offline manca
export type MioStato =
  | { stato: 'non_iscritto' }
  | { stato: 'confermato' }
  | { stato: 'in_attesa'; coda: { posizione: number; motivo: string } | null }
  | { stato: 'da_confermare'; entro: number };

const RECENTE = 3 * 60 * 60 * 1000;

function conPosto(id: string) {
  return query(
    collection(db, COLLEZIONI.attivita, id, SOTTOCOLLEZIONI.partecipanti),
    where('stato', 'in', ['confermato', 'da_confermare']),
  );
}

function cronologiaDi(id: string) {
  return query(
    collection(db, COLLEZIONI.attivita, id, SOTTOCOLLEZIONI.eventi),
    where('tipo', 'in', ['creata', 'modificata', 'annullata']),
  );
}

// attività per data
export function useElenco() {
  const [attivita, setAttivita] = useState<AttivitaConId[] | null>(null);
  const [errore, setErrore] = useState(false);
  const [daCache, setDaCache] = useState(false);

  const [adesso] = useState(Date.now);

  useEffect(() => {
    // Anche quelle cominciate da poco: chi vi partecipa deve poterle ritrovare
    const prossime = query(
      collection(db, COLLEZIONI.attivita),
      where('inizio', '>=', adesso - RECENTE),
      orderBy('inizio'),
    );

    // onSnapshot legge i dati e aggiorna in tempo reale
    // Restituisce una funzione per annullare l'iscrizione
    // Con includeMetadataChanges arriva un avviso anche quando cambia solo la provenienza dei dati
    return onSnapshot(
      prossime,
      { includeMetadataChanges: true },
      (risultato) => {
        setAttivita(risultato.docs.map((d) => ({ id: d.id, ...(d.data() as Attivita) })));
        setDaCache(risultato.metadata.fromCache);
        setErrore(false);
      },
      () => setErrore(true),
    );
  }, [adesso]);

  return { attivita, errore, daCache, adesso };
}

// Scarica in anticipo i dati di dettaglio delle attività a cui partecipo, così da poterli mostrare anche offline
export function useScaricoAnticipato(ids: string[]) {
  const chiave = ids.join(',');

  useEffect(() => {
    for (const id of chiave.split(',').filter(Boolean)) {
      getDocs(conPosto(id))
        // Anche i nomi
        .then((risultato) => risultato.docs.forEach((d) => void leggiNome(d.id)))
        .catch(() => {});
      getDocs(cronologiaDi(id)).catch(() => {});
    }
  }, [chiave]);
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

// Le mie richieste in attesa di partire
export function useSospese(uid: string) {
  const [sospese, setSospese] = useState<Sospesa[]>([]);

  useEffect(() => {
    let attuale = true;
    const leggi = () => {
      tutte(uid)
        .then((lette) => attuale && setSospese(lette))
        .catch(() => {});
    };

    leggi();
    const smetti = ascolta(leggi);
    return () => {
      attuale = false;
      smetti();
    };
  }, [uid]);

  return sospese;
}

// Una sola attività: undefined finché non arriva, null se non esiste
export function useAttivita(id: string) {
  const [attivita, setAttivita] = useState<AttivitaConId | null | undefined>(undefined);
  const [errore, setErrore] = useState(false);
  const [daCache, setDaCache] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLEZIONI.attivita, id),
        { includeMetadataChanges: true },
        (d) => {
          setAttivita(d.exists() ? { id: d.id, ...(d.data() as Attivita) } : null);
          setDaCache(d.metadata.fromCache);
          setErrore(false);
        },
        () => setErrore(true),
      ),
    [id],
  );

  return { attivita, errore, daCache };
}

// Chi ha un posto, anche se da confermare
// Chi è in lista non si elenca
export function usePartecipanti(id: string) {
  const [partecipanti, setPartecipanti] = useState<PartecipanteConUid[]>([]);

  useEffect(
    () =>
      onSnapshot(conPosto(id), (risultato) =>
        setPartecipanti(risultato.docs.map((d) => ({ uid: d.id, ...(d.data() as Partecipante) }))),
      ),
    [id],
  );

  return partecipanti;
}

// Legge il mio stato in un'attività, con la posizione in lista se c'è
export function useMioStato(attivita: AttivitaConId, uid: string) {
  // undefined finché non arriva, null se non sono iscritto
  const [mio, setMio] = useState<Partecipante | null | undefined>(undefined);
  const [coda, setCoda] = useState<{ posizione: number; motivo: string } | null>(null);
  const [errore, setErrore] = useState(false);

  useEffect(
    () =>
      onSnapshot(
        doc(db, COLLEZIONI.attivita, attivita.id, SOTTOCOLLEZIONI.partecipanti, uid),
        (d) => {
          setMio(d.exists() ? (d.data() as Partecipante) : null);
          setErrore(false);
        },
        () => setErrore(true),
      ),
    [attivita.id, uid],
  );

  const inLista = mio?.stato === 'in_attesa';

  // La posizione in lista la sa solo l'API: offline manca
  useEffect(() => {
    if (!inLista) return;
    let attuale = true;
    statoIscrizione(attivita.id)
      .then((letto) => {
        if (!attuale) return;
        setCoda(letto.stato === 'in_attesa' ? { posizione: letto.posizione, motivo: letto.motivo } : null);
      })
    // Senza rete la posizione non si può sapere: resta l'ultima letta, o nessuna
      .catch(() => {});

    // Una risposta arrivata tardi non deve sovrascrivere quella più recente
    return () => {
      attuale = false;
    };
  }, [attivita, inLista]);

  return { stato: mioStato(mio, coda), errore };
}

function mioStato(mio: Partecipante | null | undefined, coda: { posizione: number; motivo: string } | null): MioStato | null {
  if (mio === undefined) return null;
  if (mio === null) return { stato: 'non_iscritto' };
  if (mio.stato === 'confermato') return { stato: 'confermato' };
  if (mio.stato === 'da_confermare') return { stato: 'da_confermare', entro: mio.confermaEntro! };
  return { stato: 'in_attesa', coda };
}

export function useCronologia(id: string) {
  const [eventi, setEventi] = useState<EventoConId[]>([]);

  useEffect(
    () =>
      onSnapshot(cronologiaDi(id), (risultato) => {
        const letti = risultato.docs.map((d) => ({ id: d.id, ...(d.data() as Evento) }));
        setEventi(letti.sort((a, b) => a.versione - b.versione));
      }),
    [id],
  );

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

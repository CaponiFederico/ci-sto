import type {
  CollectionReference,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import {
  COLLEZIONI,
  type Partecipante,
  type PoliticaCoda,
  type Statistiche,
  type StatoPartecipante,
} from 'modello';
import { db } from './firestore.js';
import { POLITICA, type Contesto } from './politiche.js';

interface Candidato {
  id: string;
  ref: DocumentReference;
  iscrittoIl: number;
  retrocessoIl: number | null;
  versioneAccettata: number;
}

export interface InCoda extends Candidato {
  punteggio: number;
  motivo: string;
}

// con la FIFO decide solo l'ordine d'arrivo
type Ordinabile = Pick<Candidato, 'id' | 'iscrittoIl' | 'retrocessoIl'> & { punteggio?: number };

// Chi ha perso il posto per una riduzione sta davanti a chi non l'ha mai avuto.
export function ordineCoda(a: Ordinabile, b: Ordinabile) {
  const retrocessoA = a.retrocessoIl !== null;
  const retrocessoB = b.retrocessoIl !== null;
  if (retrocessoA !== retrocessoB) return retrocessoA ? -1 : 1;

  // Politica dell'attività: punteggio più alto prima
  const punteggioA = a.punteggio ?? 0;
  const punteggioB = b.punteggio ?? 0;
  if (punteggioA !== punteggioB) return punteggioB - punteggioA;

  // Ordine d'arrivo; a parità di istante decide l'uid.
  if (a.iscrittoIl !== b.iscrittoIl) return a.iscrittoIl - b.iscrittoIl;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export const RETROCESSO = 'avevi il posto e lo hai perso per una riduzione: passi davanti';

interface OpzioniCoda {
  politica: PoliticaCoda;
  adesso: number;
  // Chi perde il posto non conta fra i presenti
  senza?: string[];
  nuovo?: Candidato;
}

// coda ordinata con la politica dell'attività
// posizioni e promozioni 
export async function leggiCoda(
  tx: Transaction,
  partecipanti: CollectionReference,
  { politica, adesso, senza = [], nuovo }: OpzioniCoda,
): Promise<InCoda[]> {
  const snapshot = await tx.get(partecipanti.where('stato', '==', 'in_attesa'));
  const candidati: Candidato[] = snapshot.docs.map((d) => {
    const { iscrittoIl, retrocessoIl, versioneAccettata } = d.data() as Partecipante;
    return { id: d.id, ref: d.ref, iscrittoIl, retrocessoIl, versioneAccettata };
  });
  if (nuovo) candidati.push(nuovo);

  // Con FIFO lo storico non serve
  const contesto: Contesto = { presenti: [], statistiche: new Map(), adesso };
  if (politica !== 'fifo' && candidati.length > 0) {
    if (politica === 'affinita' || politica === 'esplorazione') {
      const posti = await tx.get(partecipanti.where('stato', 'in', ['confermato', 'da_confermare']));
      contesto.presenti = posti.docs.map((d) => d.id).filter((id) => !senza.includes(id));
    }
    const statistiche = db.collection(COLLEZIONI.statistiche);
    const documenti = await tx.getAll(...candidati.map((c) => statistiche.doc(c.id)));
    for (const d of documenti) if (d.exists) contesto.statistiche.set(d.id, d.data() as Statistiche);
  }

  return candidati
    .map((c) => {
      const valutazione = POLITICA[politica](c.id, contesto);
      // Chi è retrocesso ha priorità
      return c.retrocessoIl === null ? { ...c, ...valutazione } : { ...c, ...valutazione, motivo: RETROCESSO };
    })
    .sort(ordineCoda);
}

export interface InPosto {
  id: string;
  ref: DocumentReference;
  stato: StatoPartecipante;
  iscrittoIl: number;
  confermatoIl: number | null;
}

type Retrocedibile = Pick<InPosto, 'id' | 'iscrittoIl' | 'confermatoIl'>;

// Ultimo entrato, primo fuori
export function ordineRetrocessione(a: Retrocedibile, b: Retrocedibile) {
  const confermaA = a.confermatoIl ?? a.iscrittoIl;
  const confermaB = b.confermatoIl ?? b.iscrittoIl;
  if (confermaA !== confermaB) return confermaB - confermaA;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// Chi occupa un posto organizzatore escluso
export async function leggiPosti(tx: Transaction, partecipanti: CollectionReference, organizzatore: string) {
  const snapshot = await tx.get(partecipanti.where('stato', 'in', ['confermato', 'da_confermare']));
  const posti: InPosto[] = snapshot.docs
    .filter((d) => d.id !== organizzatore)
    .map((d) => {
      const { stato, iscrittoIl, confermatoIl } = d.data() as Partecipante;
      return { id: d.id, ref: d.ref, stato, iscrittoIl, confermatoIl };
    });
  return posti.sort(ordineRetrocessione);
}

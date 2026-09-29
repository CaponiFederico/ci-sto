import type {
  CollectionReference,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import type { Partecipante, StatoPartecipante } from 'modello';

export interface InCoda {
  id: string;
  ref: DocumentReference;
  iscrittoIl: number;
  retrocessoIl: number | null;
}

type Ordinabile = Pick<InCoda, 'id' | 'iscrittoIl' | 'retrocessoIl'>;

// Chi ha perso il posto per una riduzione sta davanti a chi non l'ha mai avuto.
export function ordineCoda(a: Ordinabile, b: Ordinabile) {
  const retrocessoA = a.retrocessoIl !== null;
  const retrocessoB = b.retrocessoIl !== null;
  if (retrocessoA !== retrocessoB) return retrocessoA ? -1 : 1;

  // Ordine d'arrivo; a parità di istante decide l'uid.
  if (a.iscrittoIl !== b.iscrittoIl) return a.iscrittoIl - b.iscrittoIl;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// L'intera coda, già ordinata: è il punto in cui le politiche della coda cambieranno l'ordine.
export async function leggiCoda(tx: Transaction, partecipanti: CollectionReference) {
  const snapshot = await tx.get(partecipanti.where('stato', '==', 'in_attesa'));
  const coda: InCoda[] = snapshot.docs.map((d) => {
    const { iscrittoIl, retrocessoIl } = d.data() as Partecipante;
    return { id: d.id, ref: d.ref, iscrittoIl, retrocessoIl };
  });
  return coda.sort(ordineCoda);
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

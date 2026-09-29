import type {
  CollectionReference,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import type { Partecipante } from 'modello';

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

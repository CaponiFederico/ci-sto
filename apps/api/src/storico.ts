import { FieldValue } from 'firebase-admin/firestore';
import {
  chiaveLuogo,
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type Partecipante,
  type Statistiche,
} from 'modello';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';
import { applicaScadenze } from './riconferme.js';

export type EsitoConsolidamento =
  | { esito: 'consolidata'; presenti: string[]; esclusi: string[] }
  | { esito: 'gia_consolidata' }
  | { esito: 'rifiutato'; motivo: 'inesistente' | 'annullata' | 'non_iniziata' };

export { chiaveLuogo };

const vuote = (): Statistiche => ({
  partecipazioni: 0,
  ultimaPartecipazione: null,
  escluso: 0,
  perCategoria: {},
  perLuogo: {},
  coPartecipanti: {},
});

// All'inizio i partecipanti non cambiano più
export async function consolidaAttivita(
  idAttivita: string,
  orologio: () => number = Date.now,
): Promise<EsitoConsolidamento> {
  if (!ID_ATTIVITA.test(idAttivita)) return { esito: 'rifiutato', motivo: 'inesistente' };
  // Chi non ha riconfermato non è presente
  await applicaScadenze(idAttivita, orologio);

  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const statistiche = db.collection(COLLEZIONI.statistiche);

  return db.runTransaction(async (tx): Promise<EsitoConsolidamento> => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(attivitaRif);
    if (!attivitaDoc.exists) return { esito: 'rifiutato', motivo: 'inesistente' };
    const attivita = attivitaDoc.data() as Attivita;

    // attività annullata nessuno ha partecipato
    if (attivita.stato === 'annullata') return { esito: 'rifiutato', motivo: 'annullata' };
    if ((attivita.consolidataIl ?? null) !== null) return { esito: 'gia_consolidata' };
    if (attivita.inizio > adesso) return { esito: 'rifiutato', motivo: 'non_iniziata' };

    const partecipanti = await tx.get(attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti));
    const conStato = (stato: Partecipante['stato']) =>
      partecipanti.docs.filter((d) => d.get('stato') === stato).map((d) => d.id);
    const presenti = conStato('confermato');
    const esclusi = conStato('in_attesa');

    const coinvolti = [...presenti, ...esclusi];
    const documenti = await tx.getAll(...coinvolti.map((uid) => statistiche.doc(uid)));
    const precedenti = new Map(documenti.map((d) => [d.id, d.exists ? (d.data() as Statistiche) : null]));
    const luogo = chiaveLuogo(attivita.luogo);

    for (const uid of presenti) {
      const prima = precedenti.get(uid);
      const altri = presenti.filter((altro) => altro !== uid);
      tx.set(
        statistiche.doc(uid),
        {
          ...(prima ? {} : vuote()),
          partecipazioni: FieldValue.increment(1),
          ultimaPartecipazione: Math.max(prima?.ultimaPartecipazione ?? 0, attivita.inizio),
          perCategoria: { [attivita.categoria]: FieldValue.increment(1) },
          perLuogo: { [luogo]: FieldValue.increment(1) },
          coPartecipanti: Object.fromEntries(altri.map((altro) => [altro, FieldValue.increment(1)])),
        },
        { merge: true },
      );
    }
    for (const uid of esclusi) {
      const prima = precedenti.get(uid);
      tx.set(
        statistiche.doc(uid),
        { ...(prima ? {} : vuote()), escluso: FieldValue.increment(1) },
        { merge: true },
      );
    }
    tx.update(attivitaRif, { consolidataIl: adesso } satisfies Partial<Attivita>);

    return { esito: 'consolidata', presenti, esclusi };
  }, { maxAttempts: TENTATIVI });
}

export interface Consolidata {
  id: string;
  titolo: string;
  esito: EsitoConsolidamento;
}

// Consolida tutte le attività cominciate che non lo sono ancora
export async function consolidaCominciate(orologio: () => number = Date.now): Promise<Consolidata[]> {
  const cominciate = await db.collection(COLLEZIONI.attivita).where('inizio', '<=', orologio()).get();

  // Il filtro evita una transazione per ogni attività già a posto
  const daFare = cominciate.docs.filter((d) => {
    const attivita = d.data() as Attivita;
    return attivita.stato !== 'annullata' && (attivita.consolidataIl ?? null) === null;
  });

  const fatte: Consolidata[] = [];
  // Una alla volta
  for (const d of daFare) {
    fatte.push({ id: d.id, titolo: (d.data() as Attivita).titolo, esito: await consolidaAttivita(d.id, orologio) });
  }
  return fatte;
}

import type { CollectionReference, Transaction } from 'firebase-admin/firestore';
import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoRiconferma,
  type Evento,
  type MotivoRifiutoRiconferma,
  type Partecipante,
} from 'modello';
import { leggiCoda, type InCoda } from './coda.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';

export const RICONFERMA_ORE = 24;

// Il tempo di decidere, ma mai oltre l'inizio
export function scadenzaRiconferma(adesso: number, inizio: number) {
  return Math.min(adesso + RICONFERMA_ORE * 60 * 60 * 1000, inizio);
}

type Riferimento = Pick<Attivita, 'versione' | 'versioneMaggiore' | 'inizio'>;

// Chi aspettava in coda da prima di una modifica maggiore entra ma deve riconfermare
export function promuovi(
  tx: Transaction,
  eventi: CollectionReference,
  p: InCoda,
  attivita: Riferimento,
  adesso: number,
) {
  const daConfermare = p.versioneAccettata < attivita.versioneMaggiore;
  tx.update(p.ref, {
    stato: daConfermare ? 'da_confermare' : 'confermato',
    confermatoIl: adesso,
    retrocessoIl: null,
    confermaEntro: daConfermare ? scadenzaRiconferma(adesso, attivita.inizio) : null,
  } satisfies Partial<Partecipante>);
  tx.set(eventi.doc(), {
    tipo: 'promosso',
    utente: p.id,
    quando: adesso,
    versione: attivita.versione,
  } satisfies Evento);
  return daConfermare;
}

function riferimenti(idAttivita: string) {
  const attivita = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  return {
    attivita,
    partecipanti: attivita.collection(SOTTOCOLLEZIONI.partecipanti),
    eventi: attivita.collection(SOTTOCOLLEZIONI.eventi),
  };
}

// Chi non ha riconfermato in tempo perde il posto
export async function applicaScadenze(idAttivita: string, orologio: () => number = Date.now) {
  const nessuno = { scaduti: [] as string[], promossi: [] as string[] };
  if (!ID_ATTIVITA.test(idAttivita)) return nessuno;
  const rif = riferimenti(idAttivita);

  return db.runTransaction(async (tx) => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(rif.attivita);
    if (!attivitaDoc.exists) return nessuno;
    const attivita = attivitaDoc.data() as Attivita;
    if (attivita.stato === 'annullata' || attivita.daConfermare === 0) return nessuno;

    const pendenti = await tx.get(rif.partecipanti.where('stato', '==', 'da_confermare'));
    const scaduti = pendenti.docs.filter((d) => (d.get('confermaEntro') as number) <= adesso);
    if (scaduti.length === 0) return nessuno;

    // Ad attività cominciata chi è in coda non fa in tempo
    const cominciata = attivita.inizio <= adesso;
    const promossi =
      !cominciata && attivita.inAttesa > 0
        ? (await leggiCoda(tx, rif.partecipanti)).slice(0, scaduti.length)
        : [];

    for (const d of scaduti) {
      tx.delete(d.ref);
      tx.set(rif.eventi.doc(), {
        tipo: 'scaduto',
        utente: d.id,
        quando: adesso,
        versione: attivita.versione,
      } satisfies Evento);
    }
    const nuoviDaConfermare = promossi.filter((p) => promuovi(tx, rif.eventi, p, attivita, adesso)).length;

    const postiOccupati = attivita.postiOccupati - scaduti.length + promossi.length;
    tx.update(rif.attivita, {
      postiOccupati,
      inAttesa: attivita.inAttesa - promossi.length,
      daConfermare: attivita.daConfermare - scaduti.length + nuoviDaConfermare,
      stato: postiOccupati >= attivita.capacita ? 'completa' : 'aperta',
    } satisfies Partial<Attivita>);

    return { scaduti: scaduti.map((d) => d.id), promossi: promossi.map((p) => p.id) };
  }, { maxAttempts: TENTATIVI });
}

function rifiutato(motivo: MotivoRifiutoRiconferma): EsitoRiconferma {
  return { esito: 'rifiutato', motivo };
}

export async function riconferma(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoRiconferma> {
  if (!ID_ATTIVITA.test(idAttivita)) return rifiutato('inesistente');
  const rif = riferimenti(idAttivita);
  const partecipanteRif = rif.partecipanti.doc(uid);

  const esito = await db.runTransaction(async (tx): Promise<EsitoRiconferma> => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(rif.attivita);
    const partecipanteDoc = await tx.get(partecipanteRif);
    if (!attivitaDoc.exists) return rifiutato('inesistente');
    const attivita = attivitaDoc.data() as Attivita;
    if (attivita.stato === 'annullata') return rifiutato('annullata');

    if (!partecipanteDoc.exists) return rifiutato('non_iscritto');
    const { stato, confermaEntro } = partecipanteDoc.data() as Partecipante;
    // Riconferma ripetuta: stesso esito, nessuna scrittura.
    if (stato === 'confermato') return { esito: 'confermato' };
    if (stato === 'in_attesa') return rifiutato('in_coda');
    if (confermaEntro! <= adesso) return rifiutato('scaduta');

    tx.update(partecipanteRif, {
      stato: 'confermato',
      confermaEntro: null,
      versioneAccettata: attivita.versione,
    } satisfies Partial<Partecipante>);
    tx.update(rif.attivita, { daConfermare: attivita.daConfermare - 1 } satisfies Partial<Attivita>);
    tx.set(rif.eventi.doc(), {
      tipo: 'riconfermato',
      utente: uid,
      quando: adesso,
      versione: attivita.versione,
    } satisfies Evento);
    return { esito: 'confermato' };
  }, { maxAttempts: TENTATIVI });

  // Fuori tempo
  if (esito.esito === 'rifiutato' && esito.motivo === 'scaduta') await applicaScadenze(idAttivita, orologio);
  return esito;
}

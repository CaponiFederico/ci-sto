import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoIscrizione,
  type EsitoUscita,
  type Evento,
  type MotivoRifiuto,
  type Partecipante,
} from 'modello';
import { leggiCoda } from './coda.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';

function rifiutato(motivo: MotivoRifiuto): EsitoIscrizione {
  return { esito: 'rifiutato', motivo };
}

export async function iscrivi(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoIscrizione> {
  if (!ID_ATTIVITA.test(idAttivita)) return rifiutato('inesistente');
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);
  const partecipanteRif = partecipanti.doc(uid);

  return db.runTransaction(async (tx) => {
    // Letto a ogni tentativo
    const adesso = orologio();

    // Firestore vuole tutte le letture prima della prima scrittura.
    const attivitaDoc = await tx.get(attivitaRif);
    if (!attivitaDoc.exists) return rifiutato('inesistente');
    const attivita = attivitaDoc.data() as Attivita;

    if (attivita.stato === 'annullata') return rifiutato('annullata');

    // Richiesta ripetuta, o dell'organizzatore: stesso esito, nessuna scrittura.
    const partecipanteDoc = await tx.get(partecipanteRif);
    if (partecipanteDoc.exists) {
      const { stato, confermaEntro } = partecipanteDoc.data() as Partecipante;
      if (stato === 'da_confermare') return { esito: 'da_confermare', entro: confermaEntro! };
      if (stato === 'confermato') return { esito: 'confermato' };
      const coda = await leggiCoda(tx, partecipanti);
      return { esito: 'in_attesa', posizione: coda.findIndex((p) => p.id === uid) + 1 };
    }

    if (attivita.inizio <= adesso) return rifiutato('iniziata');

    const confermato = attivita.postiOccupati < attivita.capacita;
    const partecipante: Partecipante = {
      stato: confermato ? 'confermato' : 'in_attesa',
      iscrittoIl: adesso,
      punteggio: 0,
      versioneAccettata: attivita.versione,
      confermaEntro: null,
      confermatoIl: confermato ? adesso : null,
      retrocessoIl: null,
    };
    const evento: Evento = {
      tipo: 'iscritto',
      utente: uid,
      quando: adesso,
      versione: attivita.versione,
    };

    tx.set(partecipanteRif, partecipante);
    tx.set(attivitaRif.collection(SOTTOCOLLEZIONI.eventi).doc(), evento);

    // Due ingressi simultanei vanno in conflitto.
    if (!confermato) {
      const inAttesa = attivita.inAttesa + 1;
      tx.update(attivitaRif, { inAttesa } satisfies Partial<Attivita>);
      return { esito: 'in_attesa', posizione: inAttesa };
    }

    const postiOccupati = attivita.postiOccupati + 1;
    tx.update(attivitaRif, {
      postiOccupati,
      stato: postiOccupati === attivita.capacita ? 'completa' : 'aperta',
    } satisfies Partial<Attivita>);

    return { esito: 'confermato' };
  }, { maxAttempts: TENTATIVI });
}

export async function esci(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoUscita> {
  if (!ID_ATTIVITA.test(idAttivita)) return { esito: 'non_iscritto' };
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);
  const partecipanteRif = partecipanti.doc(uid);
  const eventi = attivitaRif.collection(SOTTOCOLLEZIONI.eventi);

  return db.runTransaction(async (tx) => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(attivitaRif);
    const partecipanteDoc = await tx.get(partecipanteRif);

    // Uscita ripetuta
    if (!attivitaDoc.exists || !partecipanteDoc.exists) return { esito: 'non_iscritto' };
    const attivita = attivitaDoc.data() as Attivita;
    const { stato } = partecipanteDoc.data() as Partecipante;

    if (attivita.stato === 'annullata') return { esito: 'rifiutato', motivo: 'annullata' };
    if (attivita.inizio <= adesso) return { esito: 'rifiutato', motivo: 'iniziata' };
    // Per andarsene l'organizzatore annulla l'attività
    if (attivita.organizzatore === uid) return { esito: 'rifiutato', motivo: 'organizzatore' };

    // Il primo in coda si cerca solo se si libera un posto
    const primo =
      stato !== 'in_attesa' && attivita.inAttesa > 0
        ? (await leggiCoda(tx, partecipanti))[0]
        : undefined;

    // Chi doveva riconfermare teneva il posto
    const contatori: Partial<Attivita> =
      stato === 'da_confermare' ? { daConfermare: attivita.daConfermare - 1 } : {};

    const versione = attivita.versione;
    tx.delete(partecipanteRif);
    tx.set(eventi.doc(), { tipo: 'uscito', utente: uid, quando: adesso, versione } satisfies Evento);

    if (stato === 'in_attesa') {
      tx.update(attivitaRif, { inAttesa: attivita.inAttesa - 1 } satisfies Partial<Attivita>);
      return { esito: 'uscito', promosso: null };
    }

    // Il posto passa al primo in coda
    if (primo) {
      tx.update(primo.ref, {
        stato: 'confermato',
        confermatoIl: adesso,
        retrocessoIl: null,
      } satisfies Partial<Partecipante>);
      tx.set(eventi.doc(), { tipo: 'promosso', utente: primo.id, quando: adesso, versione } satisfies Evento);
      tx.update(attivitaRif, { ...contatori, inAttesa: attivita.inAttesa - 1 } satisfies Partial<Attivita>);
      return { esito: 'uscito', promosso: primo.id };
    }

    tx.update(attivitaRif, {
      ...contatori,
      postiOccupati: attivita.postiOccupati - 1,
      stato: 'aperta',
    } satisfies Partial<Attivita>);
    return { esito: 'uscito', promosso: null };
  }, { maxAttempts: TENTATIVI });
}

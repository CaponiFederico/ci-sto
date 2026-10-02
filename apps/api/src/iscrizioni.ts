import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoIscrizione,
  type EsitoUscita,
  type Evento,
  type MotivoRifiuto,
  type Partecipante,
  type StatoIscrizione,
} from 'modello';
import { leggiCoda } from './coda.js';
import { POLITICA, type Contesto } from './politiche.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';
import { promuovi, applicaScadenze } from './riconferme.js';

const VUOTO: Contesto = { presenti: [], statistiche: new Map(), adesso: 0 };

function rifiutato(motivo: MotivoRifiuto): EsitoIscrizione {
  return { esito: 'rifiutato', motivo };
}

// versioneVista: la versione dell'attività che la persona aveva davanti quando ha chiesto di iscriversi
export async function iscrivi(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
  versioneVista?: number,
): Promise<EsitoIscrizione> {
  if (!ID_ATTIVITA.test(idAttivita)) return rifiutato('inesistente');
  // Un posto non riconfermato in tempo è libero
  await applicaScadenze(idAttivita, orologio);
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
      const coda = await leggiCoda(tx, partecipanti, { politica: attivita.politicaCoda, adesso });
      const indice = coda.findIndex((p) => p.id === uid);
      return { esito: 'in_attesa', posizione: indice + 1, motivo: coda[indice]!.motivo };
    }

    if (attivita.inizio <= adesso) return rifiutato('iniziata');

    // Se la persona ha visto una versione più vecchia dell'attività, non può iscriversi: deve aggiornare la vista
    if (versioneVista !== undefined && versioneVista < attivita.versioneMaggiore) {
      return rifiutato('attivita_cambiata');
    }

    const confermato = attivita.postiOccupati < attivita.capacita;
    const partecipante: Partecipante = {
      stato: confermato ? 'confermato' : 'in_attesa',
      iscrittoIl: adesso,
      versioneAccettata: attivita.versione,
      confermaEntro: null,
      confermatoIl: confermato ? adesso : null,
      retrocessoIl: null,
    };

    // Con la FIFO chi arriva è ultimo
    // per le altre politiche la posizione dipende dallo storico
    let inCoda = { posizione: 0, motivo: '' };
    if (!confermato && attivita.politicaCoda === 'fifo') {
      inCoda = { posizione: attivita.inAttesa + 1, motivo: POLITICA.fifo(uid, VUOTO).motivo };
    } else if (!confermato) {
      const coda = await leggiCoda(tx, partecipanti, {
        politica: attivita.politicaCoda,
        adesso,
        nuovo: {
          id: uid,
          ref: partecipanteRif,
          iscrittoIl: adesso,
          retrocessoIl: null,
          versioneAccettata: attivita.versione,
        },
      });
      const indice = coda.findIndex((p) => p.id === uid);
      inCoda = { posizione: indice + 1, motivo: coda[indice]!.motivo };
    }

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
      tx.update(attivitaRif, { inAttesa: attivita.inAttesa + 1 } satisfies Partial<Attivita>);
      return { esito: 'in_attesa', ...inCoda };
    }

    const postiOccupati = attivita.postiOccupati + 1;
    tx.update(attivitaRif, {
      postiOccupati,
      stato: postiOccupati === attivita.capacita ? 'completa' : 'aperta',
    } satisfies Partial<Attivita>);

    return { esito: 'confermato' };
  }, { maxAttempts: TENTATIVI });
}

// Sola lettura
export async function statoIscrizione(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<StatoIscrizione> {
  if (!ID_ATTIVITA.test(idAttivita)) return { stato: 'non_iscritto' };
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);

  return db.runTransaction(async (tx) => {
    const attivitaDoc = await tx.get(attivitaRif);
    const partecipanteDoc = await tx.get(partecipanti.doc(uid));
    if (!attivitaDoc.exists || !partecipanteDoc.exists) return { stato: 'non_iscritto' };

    const { politicaCoda } = attivitaDoc.data() as Attivita;
    const { stato, confermaEntro } = partecipanteDoc.data() as Partecipante;
    if (stato === 'confermato') return { stato };
    if (stato === 'da_confermare') return { stato, entro: confermaEntro! };

    const coda = await leggiCoda(tx, partecipanti, { politica: politicaCoda, adesso: orologio() });
    const indice = coda.findIndex((p) => p.id === uid);
    return { stato, posizione: indice + 1, motivo: coda[indice]!.motivo };
  }, { readOnly: true });
}

export async function esci(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoUscita> {
  if (!ID_ATTIVITA.test(idAttivita)) return { esito: 'non_iscritto' };
  await applicaScadenze(idAttivita, orologio);
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
        ? (await leggiCoda(tx, partecipanti, { politica: attivita.politicaCoda, adesso, senza: [uid] }))[0]
        : undefined;

    // Chi doveva riconfermare teneva il posto
    const daConfermare = attivita.daConfermare - (stato === 'da_confermare' ? 1 : 0);

    const versione = attivita.versione;
    tx.delete(partecipanteRif);
    tx.set(eventi.doc(), { tipo: 'uscito', utente: uid, quando: adesso, versione } satisfies Evento);

    if (stato === 'in_attesa') {
      tx.update(attivitaRif, { inAttesa: attivita.inAttesa - 1 } satisfies Partial<Attivita>);
      return { esito: 'uscito', promosso: null };
    }

    // Il posto passa al primo in coda
    if (primo) {
      const primoDaConfermare = promuovi(tx, eventi, primo, attivita, adesso);
      tx.update(attivitaRif, {
        daConfermare: daConfermare + (primoDaConfermare ? 1 : 0),
        inAttesa: attivita.inAttesa - 1,
      } satisfies Partial<Attivita>);
      return { esito: 'uscito', promosso: primo.id };
    }

    tx.update(attivitaRif, {
      daConfermare,
      postiOccupati: attivita.postiOccupati - 1,
      stato: 'aperta',
    } satisfies Partial<Attivita>);
    return { esito: 'uscito', promosso: null };
  }, { maxAttempts: TENTATIVI });
}

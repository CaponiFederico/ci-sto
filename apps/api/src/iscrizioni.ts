import type { CollectionReference, Transaction } from 'firebase-admin/firestore';
import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoIscrizione,
  type Evento,
  type MotivoRifiuto,
  type Partecipante,
} from 'modello';
import { db } from './firestore.js';

// Sotto contesa 
const TENTATIVI = 10;

function rifiutato(motivo: MotivoRifiuto): EsitoIscrizione {
  return { esito: 'rifiutato', motivo };
}

// Come sono ordinati
async function posizioneInCoda(
  tx: Transaction,
  partecipanti: CollectionReference,
  uid: string,
  iscrittoIl: number,
) {
  const coda = await tx.get(partecipanti.where('stato', '==', 'in_attesa'));
  const davanti = coda.docs.filter((d) => {
    const t = d.get('iscrittoIl') as number;
    return d.id !== uid && (t < iscrittoIl || (t === iscrittoIl && d.id < uid));
  });
  return davanti.length + 1;
}

export async function iscrivi(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoIscrizione> {
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
      const { stato, iscrittoIl } = partecipanteDoc.data() as Partecipante;
      if (stato !== 'in_attesa') return { esito: 'confermato' };
      return { esito: 'in_attesa', posizione: await posizioneInCoda(tx, partecipanti, uid, iscrittoIl) };
    }

    if (attivita.inizio <= adesso) return rifiutato('iniziata');

    const confermato = attivita.postiOccupati < attivita.capacita;
    const partecipante: Partecipante = {
      stato: confermato ? 'confermato' : 'in_attesa',
      iscrittoIl: adesso,
      punteggio: 0,
      versioneAccettata: attivita.versione,
      confermaEntro: null,
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

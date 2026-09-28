import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';
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

function rifiutato(motivo: MotivoRifiuto): EsitoIscrizione {
  return { esito: 'rifiutato', motivo };
}

// A parità di istante decide l'uid
function ordineDiArrivo(a: QueryDocumentSnapshot, b: QueryDocumentSnapshot) {
  const differenza = (a.get('iscrittoIl') as number) - (b.get('iscrittoIl') as number);
  return differenza !== 0 ? differenza : a.id.localeCompare(b.id);
}

export async function iscrivi(
  idAttivita: string,
  uid: string,
  adesso = Date.now(),
): Promise<EsitoIscrizione> {
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);
  const partecipanteRif = partecipanti.doc(uid);

  return db.runTransaction(async (tx) => {
    // Firestore vuole tutte le letture prima della prima scrittura.
    const attivitaDoc = await tx.get(attivitaRif);
    const partecipanteDoc = await tx.get(partecipanteRif);
    const coda = await tx.get(partecipanti.where('stato', '==', 'in_attesa'));

    if (!attivitaDoc.exists) return rifiutato('inesistente');
    const attivita = attivitaDoc.data() as Attivita;

    if (attivita.stato === 'annullata') return rifiutato('annullata');

    // Richiesta ripetuta, o dell'organizzatore: stesso esito, nessuna scrittura.
    if (partecipanteDoc.exists) {
      if (partecipanteDoc.get('stato') !== 'in_attesa') return { esito: 'confermato' };
      const posizione = coda.docs.sort(ordineDiArrivo).findIndex((d) => d.id === uid) + 1;
      return { esito: 'in_attesa', posizione };
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

    if (!confermato) return { esito: 'in_attesa', posizione: coda.size + 1 };

    const postiOccupati = attivita.postiOccupati + 1;
    tx.update(attivitaRif, {
      postiOccupati,
      stato: postiOccupati === attivita.capacita ? 'completa' : 'aperta',
    } satisfies Partial<Attivita>);

    return { esito: 'confermato' };
  });
}

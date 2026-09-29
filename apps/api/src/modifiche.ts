import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoModifica,
  type Evento,
  type MotivoRifiutoModifica,
} from 'modello';
import type { Modifica } from './attivita.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';

function rifiutato(motivo: MotivoRifiutoModifica): EsitoModifica {
  return { esito: 'rifiutato', motivo };
}

export async function modificaAttivita(
  idAttivita: string,
  uid: string,
  modifica: Modifica,
  orologio: () => number = Date.now,
): Promise<EsitoModifica> {
  if (!ID_ATTIVITA.test(idAttivita)) return rifiutato('inesistente');
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);

  return db.runTransaction(async (tx) => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(attivitaRif);
    if (!attivitaDoc.exists) return rifiutato('inesistente');
    const attivita = attivitaDoc.data() as Attivita;

    if (attivita.organizzatore !== uid) return rifiutato('non_organizzatore');
    if (attivita.stato === 'annullata') return rifiutato('annullata');
    if (attivita.inizio <= adesso) return rifiutato('iniziata');

    // Solo ciò che cambia davvero: ripetere la stessa modifica non crea una versione nuova.
    const campi = (Object.keys(modifica) as (keyof Modifica)[]).filter(
      (c) => modifica[c] !== attivita[c],
    );
    if (campi.length === 0) return { esito: 'invariata', versione: attivita.versione };

    const versione = attivita.versione + 1;
    const cambiati: Modifica = Object.fromEntries(campi.map((c) => [c, modifica[c]]));
    const evento: Evento = {
      tipo: 'modificata',
      utente: uid,
      quando: adesso,
      versione,
      campiModificati: campi,
    };

    // versioneSostanziale resta ferma
    tx.update(attivitaRif, { ...cambiati, versione, modificataIl: adesso } satisfies Partial<Attivita>);
    tx.set(attivitaRif.collection(SOTTOCOLLEZIONI.eventi).doc(), evento);

    return { esito: 'modificata', versione, campi };
  }, { maxAttempts: TENTATIVI });
}

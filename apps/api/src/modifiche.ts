import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EsitoModifica,
  type Evento,
  type MotivoRifiutoModifica,
  type Partecipante,
} from 'modello';
import type { Modifica } from './attivita.js';
import { leggiCoda, leggiPosti } from './coda.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';

function rifiutato(motivo: MotivoRifiutoModifica): EsitoModifica {
  return { esito: 'rifiutato', motivo };
}

interface Opzioni {
  forza?: boolean;
  orologio?: () => number;
}

export async function modificaAttivita(
  idAttivita: string,
  uid: string,
  modifica: Modifica,
  { forza = false, orologio = Date.now }: Opzioni = {},
): Promise<EsitoModifica> {
  if (!ID_ATTIVITA.test(idAttivita)) return rifiutato('inesistente');
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);
  const eventi = attivitaRif.collection(SOTTOCOLLEZIONI.eventi);

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

    const capacita = modifica.capacita ?? attivita.capacita;
    const eccesso = Math.max(0, attivita.postiOccupati - capacita);
    const liberi = Math.max(0, capacita - attivita.postiOccupati);

    // Conferma necessaria in caso riduzione posti
    if (eccesso > 0 && !forza) return { esito: 'conferma_richiesta', retrocessi: eccesso };

    const retrocessi = eccesso > 0 ? (await leggiPosti(tx, partecipanti, uid)).slice(0, eccesso) : [];
    const promossi =
      liberi > 0 && attivita.inAttesa > 0 ? (await leggiCoda(tx, partecipanti)).slice(0, liberi) : [];

    const versione = attivita.versione + 1;
    const evento = (tipo: Evento['tipo'], utente: string): Evento => ({ tipo, utente, quando: adesso, versione });

    for (const p of retrocessi) {
      // retrocessoIl li mette davanti a chi non ha mai avuto il posto
      tx.update(p.ref, {
        stato: 'in_attesa',
        retrocessoIl: adesso,
        confermatoIl: null,
        confermaEntro: null,
      } satisfies Partial<Partecipante>);
      tx.set(eventi.doc(), evento('retrocesso', p.id));
    }
    for (const p of promossi) {
      tx.update(p.ref, {
        stato: 'confermato',
        confermatoIl: adesso,
        retrocessoIl: null,
      } satisfies Partial<Partecipante>);
      tx.set(eventi.doc(), evento('promosso', p.id));
    }

    const postiOccupati = attivita.postiOccupati - retrocessi.length + promossi.length;
    const cambiati: Modifica = Object.fromEntries(campi.map((c) => [c, modifica[c]]));

    // versioneSostanziale resta ferma
    tx.update(attivitaRif, {
      ...cambiati,
      postiOccupati,
      inAttesa: attivita.inAttesa + retrocessi.length - promossi.length,
      daConfermare: attivita.daConfermare - retrocessi.filter((p) => p.stato === 'da_confermare').length,
      stato: postiOccupati >= capacita ? 'completa' : 'aperta',
      versione,
      modificataIl: adesso,
    } satisfies Partial<Attivita>);
    tx.set(eventi.doc(), { ...evento('modificata', uid), campiModificati: campi });

    return {
      esito: 'modificata',
      versione,
      campi,
      promossi: promossi.map((p) => p.id),
      retrocessi: retrocessi.map((p) => p.id),
    };
  }, { maxAttempts: TENTATIVI });
}

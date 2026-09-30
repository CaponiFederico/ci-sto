import {
  COLLEZIONI,
  SOTTOCOLLEZIONI,
  type Attivita,
  type EntitaModifica,
  type EsitoAnnullamento,
  type EsitoModifica,
  type Luogo,
  type Evento,
  type MotivoRifiutoModifica,
  type Partecipante,
} from 'modello';
import type { Modifica } from './attivita.js';
import { leggiCoda, leggiPosti } from './coda.js';
import { db, ID_ATTIVITA, TENTATIVI } from './firestore.js';
import { promuovi, scadenzaRiconferma, applicaScadenze } from './riconferme.js';

// Oltre questo spostamento, di inizio o di fine
export const SOGLIA_MINUTI = 30;

const MINUTO = 60 * 1000;

// Con le coordinate conta il punto
export function stessoLuogo(a: Luogo, b: Luogo) {
  const coordinate = (l: Luogo) => l.lat !== undefined && l.lon !== undefined;
  if (coordinate(a) && coordinate(b)) return a.lat === b.lat && a.lon === b.lon;
  return a.testo === b.testo;
}

type Quando = Pick<Attivita, 'inizio' | 'durataMinuti' | 'luogo'>;

export function entitaModifica(prima: Quando, dopo: Quando): EntitaModifica {
  const fine = (q: Quando) => q.inizio + q.durataMinuti * MINUTO;
  const soglia = SOGLIA_MINUTI * MINUTO;
  const minore =
    Math.abs(dopo.inizio - prima.inizio) <= soglia &&
    Math.abs(fine(dopo) - fine(prima)) <= soglia &&
    stessoLuogo(prima.luogo, dopo.luogo);
  return minore ? 'minore' : 'maggiore';
}

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
  await applicaScadenze(idAttivita, orologio);
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
    const campi = (Object.keys(modifica) as (keyof Modifica)[]).filter((c) =>
      c === 'luogo' ? !stessoLuogo(modifica.luogo!, attivita.luogo) : modifica[c] !== attivita[c],
    );
    if (campi.length === 0) return { esito: 'invariata', versione: attivita.versione };

    if (campi.includes('politicaCoda') && attivita.inAttesa > 0) return rifiutato('coda_non_vuota');

    const capacita = modifica.capacita ?? attivita.capacita;
    const eccesso = Math.max(0, attivita.postiOccupati - capacita);
    const liberi = Math.max(0, capacita - attivita.postiOccupati);

    // Conferma necessaria in caso riduzione posti
    if (eccesso > 0 && !forza) return { esito: 'conferma_richiesta', retrocessi: eccesso };

    const dopo: Quando = {
      inizio: modifica.inizio ?? attivita.inizio,
      durataMinuti: modifica.durataMinuti ?? attivita.durataMinuti,
      luogo: modifica.luogo ?? attivita.luogo,
    };
    const tocca = campi.some((c) => c === 'inizio' || c === 'durataMinuti' || c === 'luogo');
    const entita = tocca ? entitaModifica(attivita, dopo) : null;
    const maggiore = entita === 'maggiore';

    // Chi ha il posto, e chi lo riceve dalla coda
    const posti = eccesso > 0 || maggiore ? await leggiPosti(tx, partecipanti, uid) : [];
    const retrocessi = posti.slice(0, eccesso);
    const restano = posti.slice(eccesso);
    const promossi =
      liberi > 0 && attivita.inAttesa > 0 ? (await leggiCoda(tx, partecipanti, { politica: attivita.politicaCoda, adesso })).slice(0, liberi) : [];

    const versione = attivita.versione + 1;
    const evento = (tipo: Evento['tipo'], utente: string): Evento => ({ tipo, utente, quando: adesso, versione });
    const confermaEntro = scadenzaRiconferma(adesso, dopo.inizio);
    const versioneMaggiore = maggiore ? versione : attivita.versioneMaggiore;

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
    // Con una modifica maggiore anche chi entra adesso aveva accettato l'attività di prima
    const riferimento = { versione, versioneMaggiore, inizio: dopo.inizio };
    const promossiDaConfermare = promossi.filter((p) => promuovi(tx, eventi, p, riferimento, adesso));
    if (maggiore) {
      for (const p of restano) {
        tx.update(p.ref, { stato: 'da_confermare', confermaEntro } satisfies Partial<Partecipante>);
      }
      // L'organizzatore accetta la versione che ha scritto 
      tx.update(partecipanti.doc(uid), { versioneAccettata: versione } satisfies Partial<Partecipante>);
    }

    const postiOccupati = attivita.postiOccupati - retrocessi.length + promossi.length;
    const daConfermare =
      (maggiore ? restano.length : attivita.daConfermare - retrocessi.filter((p) => p.stato === 'da_confermare').length) +
      promossiDaConfermare.length;
    const cambiati: Modifica = Object.fromEntries(campi.map((c) => [c, modifica[c]]));

    tx.update(attivitaRif, {
      ...cambiati,
      postiOccupati,
      inAttesa: attivita.inAttesa + retrocessi.length - promossi.length,
      daConfermare,
      stato: postiOccupati >= capacita ? 'completa' : 'aperta',
      versione,
      // La coda offline confronta questa
      versioneMaggiore,
      modificataIl: adesso,
    } satisfies Partial<Attivita>);
    tx.set(eventi.doc(), {
      ...evento('modificata', uid),
      campiModificati: campi,
      ...(entita && { entita }),
    });

    return {
      esito: 'modificata',
      versione,
      campi,
      entita,
      promossi: promossi.map((p) => p.id),
      retrocessi: retrocessi.map((p) => p.id),
      daConfermare: [...(maggiore ? restano : []), ...promossiDaConfermare].map((p) => p.id),
    };
  }, { maxAttempts: TENTATIVI });
}

export async function annullaAttivita(
  idAttivita: string,
  uid: string,
  orologio: () => number = Date.now,
): Promise<EsitoAnnullamento> {
  if (!ID_ATTIVITA.test(idAttivita)) return { esito: 'rifiutato', motivo: 'inesistente' };
  const attivitaRif = db.collection(COLLEZIONI.attivita).doc(idAttivita);
  const partecipanti = attivitaRif.collection(SOTTOCOLLEZIONI.partecipanti);

  return db.runTransaction(async (tx): Promise<EsitoAnnullamento> => {
    const adesso = orologio();

    const attivitaDoc = await tx.get(attivitaRif);
    if (!attivitaDoc.exists) return { esito: 'rifiutato', motivo: 'inesistente' };
    const attivita = attivitaDoc.data() as Attivita;

    if (attivita.organizzatore !== uid) return { esito: 'rifiutato', motivo: 'non_organizzatore' };
    // Annullamento ripetuto: nessuno da avvisare di nuovo.
    if (attivita.stato === 'annullata') return { esito: 'annullata', avvisare: [] };
    if (attivita.inizio <= adesso) return { esito: 'rifiutato', motivo: 'iniziata' };

    // I partecipanti restano dove sono per sapere chi avvisare 
    const iscritti = await tx.get(partecipanti);
    const versione = attivita.versione + 1;

    tx.update(attivitaRif, { stato: 'annullata', versione, modificataIl: adesso } satisfies Partial<Attivita>);
    tx.set(attivitaRif.collection(SOTTOCOLLEZIONI.eventi).doc(), {
      tipo: 'annullata',
      utente: uid,
      quando: adesso,
      versione,
    } satisfies Evento);

    return { esito: 'annullata', avvisare: iscritti.docs.map((d) => d.id).filter((id) => id !== uid) };
  }, { maxAttempts: TENTATIVI });
}

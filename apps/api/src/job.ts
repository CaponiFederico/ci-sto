import { COLLEZIONI, SOTTOCOLLEZIONI, type Attivita, type Partecipante } from 'modello';
import { mandaAvvisi, type Avviso } from './avvisi.js';
import { db, TENTATIVI } from './firestore.js';
import { applicaScadenze } from './riconferme.js';
import { consolidaAttivita } from './storico.js';

const ORA = 60 * 60 * 1000;


export const ANTICIPO_PROMEMORIA = 2 * ORA;
export const PREAVVISO_SCADENZA = 3 * ORA;
const FINESTRA = 7 * 24 * ORA;
// ogni 5 minuti, ma un giro non parte se il precedente non ha finito
export const INTERVALLO_JOB = 5 * 60 * 1000;

export interface EsitoJob {
  consolidate: number;
  scadute: number;
  promemoria: number;
  preavvisi: number;
}

function riferimenti(id: string) {
  const attivita = db.collection(COLLEZIONI.attivita).doc(id);
  return { attivita, partecipanti: attivita.collection(SOTTOCOLLEZIONI.partecipanti) };
}

async function prenotaPromemoria(id: string, orologio: () => number): Promise<Avviso[]> {
  const rif = riferimenti(id);

  return db.runTransaction(async (tx) => {
    const adesso = orologio();
    const attivita = (await tx.get(rif.attivita)).data() as Attivita | undefined;
    if (!attivita || attivita.stato === 'annullata') return [];
    if (attivita.inizio <= adesso || attivita.inizio > adesso + ANTICIPO_PROMEMORIA) return [];
    if (attivita.promemoriaPer === attivita.inizio) return [];

    const posti = await tx.get(rif.partecipanti.where('stato', 'in', ['confermato', 'da_confermare']));
    tx.update(rif.attivita, { promemoriaPer: attivita.inizio } satisfies Partial<Attivita>);

    return posti.docs.map((d) => ({
      a: d.id,
      tipo: 'promemoria' as const,
      attivita: id,
      titolo: attivita.titolo,
      inizio: attivita.inizio,
    }));
  }, { maxAttempts: TENTATIVI });
}
//preavvisi per chi deve riconfermare 
async function prenotaPreavvisi(id: string, orologio: () => number): Promise<Avviso[]> {  
  const rif = riferimenti(id);

  return db.runTransaction(async (tx) => {
    const adesso = orologio();
    const attivita = (await tx.get(rif.attivita)).data() as Attivita | undefined;
    if (!attivita || attivita.stato === 'annullata' || attivita.daConfermare === 0) return [];

    const pendenti = await tx.get(rif.partecipanti.where('stato', '==', 'da_confermare'));
    const avvisi: Avviso[] = [];
    for (const d of pendenti.docs) {
      const { confermaEntro, scadenzaAvvisata } = d.data() as Partecipante;
      if (confermaEntro === null || confermaEntro <= adesso || confermaEntro > adesso + PREAVVISO_SCADENZA) continue;
      if (scadenzaAvvisata === confermaEntro) continue;

      tx.update(d.ref, { scadenzaAvvisata: confermaEntro } satisfies Partial<Partecipante>);
      avvisi.push({ a: d.id, tipo: 'scadenza_vicina', attivita: id, titolo: attivita.titolo, entro: confermaEntro });
    }
    return avvisi;
  }, { maxAttempts: TENTATIVI });
}

export async function eseguiJob(
  orologio: () => number = Date.now,
  manda: (avvisi: Avviso[]) => Promise<unknown> = mandaAvvisi,
): Promise<EsitoJob> {
  const esito: EsitoJob = { consolidate: 0, scadute: 0, promemoria: 0, preavvisi: 0 };
  const adesso = orologio();
  const recenti = await db.collection(COLLEZIONI.attivita).where('inizio', '>=', adesso - FINESTRA).get();

  for (const d of recenti.docs) {
    const attivita = d.data() as Attivita;
    if (attivita.stato === 'annullata') continue;
    const avvisi: Avviso[] = [];

    try {
      if (attivita.inizio <= adesso) {
        if ((attivita.consolidataIl ?? null) === null) {
          const consolidamento = await consolidaAttivita(d.id, orologio);
          if (consolidamento.esito === 'consolidata') esito.consolidate += 1;
        }
        continue;
      }

      if (attivita.daConfermare > 0) {
        const { scaduti } = await applicaScadenze(d.id, orologio, (nuovi) => avvisi.push(...nuovi));
        esito.scadute += scaduti.length;

        const preavvisi = await prenotaPreavvisi(d.id, orologio);
        esito.preavvisi += preavvisi.length;
        avvisi.push(...preavvisi);
      }

      if (attivita.inizio <= adesso + ANTICIPO_PROMEMORIA && attivita.promemoriaPer !== attivita.inizio) {
        const promemoria = await prenotaPromemoria(d.id, orologio);
        esito.promemoria += promemoria.length;
        avvisi.push(...promemoria);
      }
    } catch (errore) {
      console.warn(`job: attività ${d.id} saltata:`, (errore as Error).message);
    }

    await manda(avvisi);
  }

  return esito;
}

// Un giro subito e poi a intervalli
export function avviaJob() {
  let inCorso = false;

  const giro = async () => {
    if (inCorso) return;
    inCorso = true;
    try {
      const esito = await eseguiJob();
      if (Object.values(esito).some((n) => n > 0)) console.log('job:', esito);
    } catch (errore) {
      console.warn('job non riuscito:', (errore as Error).message);
    } finally {
      inCorso = false;
    }
  };

  void giro();
  return setInterval(() => void giro(), INTERVALLO_JOB);
}

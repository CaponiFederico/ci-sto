import { COLLEZIONI, type Notifica, type Utente } from 'modello';
import { db } from './firestore.js';
import { invia } from './push.js';

export type TipoAvviso =
  | 'iscritto'
  | 'in_lista'
  | 'uscito'
  | 'promosso'
  | 'da_riconfermare'
  | 'modificata'
  | 'retrocesso'
  | 'annullata'
  | 'scaduto'
  | 'promemoria'
  | 'scadenza_vicina';

export interface Avviso {
  a: string;
  tipo: TipoAvviso;
  attivita: string;
  titolo: string;
  chi?: string;
  entro?: number;
  // per il promemoria
  inizio?: number;
}

// Può essere chiamata più di una volta per la stessa operazione: chi la passa accumula
export type Avvisa = (avvisi: Avviso[]) => void;

const ora = new Intl.DateTimeFormat('it-IT', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Rome',
});

const TESTO: Record<TipoAvviso, (avviso: Avviso, nome: string) => string> = {
  iscritto: (_avviso, nome) => `${nome} si è iscritto`,
  in_lista: (_avviso, nome) => `${nome} si è messo in lista d’attesa`,
  uscito: (_avviso, nome) => `${nome} ha lasciato il posto`,
  promosso: (avviso) =>
    avviso.entro === undefined
      ? 'Si è liberato un posto: ora partecipi'
      : `Si è liberato un posto: riconferma entro ${ora.format(avviso.entro)}`,
  da_riconfermare: (avviso) => `Orario o luogo sono cambiati: riconferma entro ${ora.format(avviso.entro)}`,
  modificata: () => 'Orario o luogo sono cambiati: controlla i dettagli',
  retrocesso: () => 'I posti sono diminuiti: ora sei in testa alla lista d’attesa',
  annullata: () => 'L’attività è stata annullata',
  scaduto: () => 'Non hai riconfermato in tempo: il tuo posto è stato liberato',
  promemoria: (avviso) => `Comincia ${ora.format(avviso.inizio)}`,
  scadenza_vicina: (avviso) => `Riconferma entro ${ora.format(avviso.entro)}, poi il posto si libera`,
};

async function nomeDi(uid: string) {
  const utente = (await db.collection(COLLEZIONI.utenti).doc(uid).get()).data() as Partial<Utente> | undefined;
  return utente?.nome ?? 'Qualcuno';
}

export function creaAvvisi(manda: (uid: string, notifica: Notifica) => Promise<unknown>) {
  return async function mandaAvvisi(avvisi: Avviso[]) {
    for (const avviso of avvisi) {
      if (avviso.a === avviso.chi) continue;

      try {
        const nome = avviso.chi ? await nomeDi(avviso.chi) : '';
        await manda(avviso.a, {
          titolo: avviso.titolo,
          testo: TESTO[avviso.tipo](avviso, nome),
          indirizzo: `/#/attivita/${avviso.attivita}`,
          // Una notifica nuova dello stesso tipo sulla stessa attività sostituisce la precedente
          etichetta: `${avviso.attivita}:${avviso.tipo}`,
        });
      } catch (errore) {
        console.warn('avviso non inviato:', (errore as Error).message);
      }
    }
  };
}

export const mandaAvvisi = creaAvvisi(invia);

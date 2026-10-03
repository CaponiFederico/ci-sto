import { chiaveLuogo, type Statistiche } from 'modello';
import type { AttivitaConId } from './dati';

// peso dei segnali che fanno salire un'attività
export const PESI = { persone: 3, categoria: 2, luogo: 1, imminenza: 4 } as const;

// Oltre il tetto un segnale non cresce più
export const TETTO_PERSONE = 3;
export const TETTO_VOLTE = 5;
// La finestra temporale in cui l'imminenza conta: oltre non fa più salire
export const FINESTRA_GIORNI = 14;

const GIORNO = 24 * 60 * 60 * 1000;

type Segnale = keyof typeof PESI;
type SegnalePersonale = Exclude<Segnale, 'imminenza'>;

// Motivo del perché un'attività è salita in classifica
// Dipende da utente a utente
export interface Motivo {
  segnale: SegnalePersonale;
  // Persone conosciute, oppure volte in quella categoria o in quel luogo
  quanti: number;
}

export interface Valutazione {
  punteggio: number;
  motivo: Motivo | null;
}

export type Valutata = Valutazione & { attivita: AttivitaConId };

// Chi ha il posto in ciascuna attività
export type Presenti = Record<string, string[]>;

// 
export function valuta(
  attivita: AttivitaConId,
  statistiche: Statistiche | null,
  presenti: string[],
  uid: string,
  adesso: number,
): Valutazione {
  const insieme = statistiche?.coPartecipanti ?? {};

  // Contano le persone, non le volte
  const quanti: Record<SegnalePersonale, number> = {
    persone: presenti.filter((altro) => altro !== uid && (insieme[altro] ?? 0) > 0).length,
    categoria: statistiche?.perCategoria[attivita.categoria] ?? 0,
    luogo: statistiche?.perLuogo[chiaveLuogo(attivita.luogo.testo)] ?? 0,
  };

  const giorni = Math.max(0, attivita.inizio - adesso) / GIORNO;

  // Ogni segnale vale fra 0 e 1
  const segnali: Record<Segnale, number> = {
    persone: Math.min(quanti.persone, TETTO_PERSONE) / TETTO_PERSONE,
    categoria: Math.min(quanti.categoria, TETTO_VOLTE) / TETTO_VOLTE,
    luogo: Math.min(quanti.luogo, TETTO_VOLTE) / TETTO_VOLTE,
    imminenza: Math.max(0, 1 - giorni / FINESTRA_GIORNI),
  };

  let punteggio = 0;
  for (const s of Object.keys(PESI) as Segnale[]) punteggio += PESI[s] * segnali[s];

  // Il motivo è il segnale personale che ha contato di più
  // a parità il primo dell'elenco
  let motivo: Motivo | null = null;
  let migliore = 0;
  for (const s of ['persone', 'categoria', 'luogo'] as const) {
    const contributo = PESI[s] * segnali[s];
    if (contributo > migliore) {
      migliore = contributo;
      motivo = { segnale: s, quanti: quanti[s] };
    }
  }

  return { punteggio, motivo };
}

// Restituisce un elenco nuovo
export function ordina(
  elenco: AttivitaConId[],
  statistiche: Statistiche | null,
  presenti: Presenti,
  uid: string,
  adesso: number,
): Valutata[] {
  const valutate = elenco.map((attivita) => ({
    attivita,
    ...valuta(attivita, statistiche, presenti[attivita.id] ?? [], uid, adesso),
  }));

  return valutate.sort((a, b) => {
    // attività annullata sta in fondo
    const annullate = Number(a.attivita.stato === 'annullata') - Number(b.attivita.stato === 'annullata');
    if (annullate !== 0) return annullate;
    if (a.punteggio !== b.punteggio) return b.punteggio - a.punteggio;
    // A parità prima quella che comincia prima, poi per id
    if (a.attivita.inizio !== b.attivita.inizio) return a.attivita.inizio - b.attivita.inizio;
    return a.attivita.id < b.attivita.id ? -1 : 1;
  });
}

export const COLLEZIONI = {
  utenti: 'utenti',
  attivita: 'attivita',
  statistiche: 'statistiche',
  sottoscrizioni: 'sottoscrizioni',
} as const;

export const SOTTOCOLLEZIONI = {
  partecipanti: 'partecipanti',
  eventi: 'eventi',
  coPartecipanti: 'coPartecipanti',
  dispositivi: 'dispositivi',
} as const;

export const CAPACITA_MINIMA = 2;
export const CAPACITA_MASSIMA = 100;

export type Categoria = 'sport' | 'studio' | 'trasporto' | 'svago' | 'altro';

export type StatoAttivita = 'aperta' | 'completa' | 'annullata';

export type StatoPartecipante = 'confermato' | 'in_attesa' | 'da_confermare' | 'uscito';

export type PoliticaCoda = 'fifo' | 'affinita' | 'esplorazione' | 'rotazione' | 'equita';

export const POLITICHE: readonly PoliticaCoda[] = [
  'fifo',
  'affinita',
  'esplorazione',
  'rotazione',
  'equita',
];

export interface Luogo {
  testo: string;
  nome?: string;
  lat?: number;
  lon?: number;
}

export interface Utente {
  email: string;
  nome: string;
  creatoIl: number;
  ultimoAccesso: number;
}

export interface Attivita {
  titolo: string;
  descrizione: string;
  categoria: Categoria;
  inizio: number;
  durataMinuti: number;
  luogo: Luogo;
  capacita: number;
  postiOccupati: number;
  organizzatore: string;
  politicaCoda: PoliticaCoda;
  stato: StatoAttivita;
  versione: number;
  creataIl: number;
  modificataIl: number;
}

export interface Partecipante {
  stato: StatoPartecipante;
  iscrittoIl: number;
  punteggio: number;
  posizione: number | null;
  versioneAccettata: number;
  confermaEntro: number | null;
}

export type TipoEvento =
  | 'creata'
  | 'modificata'
  | 'iscritto'
  | 'promosso'
  | 'retrocesso'
  | 'uscito'
  | 'riconfermato'
  | 'scaduto'
  | 'annullata';

export interface Evento {
  tipo: TipoEvento;
  utente: string;
  quando: number;
  versione: number;
  campiModificati?: string[];
}

export interface Statistiche {
  partecipazioni: number;
  ultimaPartecipazione: number | null;
  escluso: number;
  perCategoria: Partial<Record<Categoria, number>>;
  perLuogo: Record<string, number>;
}

export interface CoPartecipante {
  conteggio: number;
  ultimaVolta: number;
}

export interface Sottoscrizione {
  endpoint: string;
  chiavi: { p256dh: string; auth: string };
  creataIl: number;
}

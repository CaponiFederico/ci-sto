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

export const CATEGORIE: readonly Categoria[] = ['sport', 'studio', 'trasporto', 'svago', 'altro'];

export type StatoAttivita = 'aperta' | 'completa' | 'annullata';

export type StatoPartecipante = 'confermato' | 'in_attesa' | 'da_confermare';

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
  primoAccesso: number;
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
  inAttesa: number;
  organizzatore: string;
  politicaCoda: PoliticaCoda;
  stato: StatoAttivita;
  versione: number;
  creataIl: number;
  modificataIl: number;
}

export interface NuovaAttivita {
  titolo: string;
  descrizione: string;
  categoria: Categoria;
  inizio: number;
  durataMinuti: number;
  luogo: Luogo;
  capacita: number;
  politicaCoda: PoliticaCoda;
}

export interface Partecipante {
  stato: StatoPartecipante;
  iscrittoIl: number;
  punteggio: number;
  versioneAccettata: number;
  confermaEntro: number | null;
}

export type MotivoRifiuto = 'inesistente' | 'annullata' | 'iniziata';

export type EsitoIscrizione =
  | { esito: 'confermato' }
  | { esito: 'in_attesa'; posizione: number }
  | { esito: 'rifiutato'; motivo: MotivoRifiuto };

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

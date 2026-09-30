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
  daConfermare: number;
  organizzatore: string;
  politicaCoda: PoliticaCoda;
  stato: StatoAttivita;
  versione: number;
  versioneMaggiore: number;
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
  confermatoIl: number | null;
  retrocessoIl: number | null;
}

export type MotivoRifiuto = 'inesistente' | 'annullata' | 'iniziata';

export type EsitoIscrizione =
  | { esito: 'confermato' }
  | { esito: 'in_attesa'; posizione: number }
  | { esito: 'da_confermare'; entro: number }
  | { esito: 'rifiutato'; motivo: MotivoRifiuto };

export type MotivoRifiutoUscita = 'annullata' | 'iniziata' | 'organizzatore';

export type EsitoUscita =
  | { esito: 'uscito'; promosso: string | null }
  | { esito: 'non_iscritto' }
  | { esito: 'rifiutato'; motivo: MotivoRifiutoUscita };

export type MotivoRifiutoRiconferma = 'inesistente' | 'annullata' | 'non_iscritto' | 'in_coda' | 'scaduta';

export type EsitoRiconferma =
  | { esito: 'confermato' }
  | { esito: 'rifiutato'; motivo: MotivoRifiutoRiconferma };

// Minore: gli iscritti restano; maggiore: devono riconfermare.
export type EntitaModifica = 'minore' | 'maggiore';

export type MotivoRifiutoModifica =
  | 'inesistente'
  | 'non_organizzatore'
  | 'annullata'
  | 'iniziata'
  | 'coda_non_vuota';

export type MotivoRifiutoAnnullamento = 'inesistente' | 'non_organizzatore' | 'iniziata';

export type EsitoAnnullamento =
  | { esito: 'annullata'; avvisare: string[] }
  | { esito: 'rifiutato'; motivo: MotivoRifiutoAnnullamento };

export type EsitoModifica =
  | {
      esito: 'modificata';
      versione: number;
      campi: string[];
      entita: EntitaModifica | null;
      promossi: string[];
      retrocessi: string[];
      daConfermare: string[];
    }
  | { esito: 'invariata'; versione: number }
  | { esito: 'conferma_richiesta'; retrocessi: number }
  | { esito: 'rifiutato'; motivo: MotivoRifiutoModifica };

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
  entita?: EntitaModifica;
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

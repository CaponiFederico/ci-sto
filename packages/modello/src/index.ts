export const COLLEZIONI = {
  utenti: 'utenti',
  attivita: 'attivita',
  statistiche: 'statistiche',
  sottoscrizioni: 'sottoscrizioni',
} as const;

export const SOTTOCOLLEZIONI = {
  partecipanti: 'partecipanti',
  eventi: 'eventi',
  dispositivi: 'dispositivi',
} as const;

export const CAPACITA_MINIMA = 2;
export const CAPACITA_MASSIMA = 100;

export const DURATA_MINIMA = 15;
export const DURATA_MASSIMA = 24 * 60;

// Li usano sia i controlli dell'API sia il modulo nel browser
export const LUNGHEZZA_MASSIMA = { titolo: 120, descrizione: 2000, luogo: 200, civico: 10 } as const;

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
  civico?: string;
  nome?: string;
  lat?: number;
  lon?: number;
}

// Un risultato della ricerca di un luogo
export interface LuogoTrovato {
  nome: string;
  lat: number;
  lon: number;
}

export const RICERCA_LUOGO = { minima: 3, massima: 200 } as const;

export type EsitoRicerca = { esito: 'trovati'; luoghi: LuogoTrovato[] } | { esito: 'non_disponibile' };

export interface Utente {
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
  consolidataIl: number | null;
  promemoriaPer?: number;
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
  versioneAccettata: number;
  confermaEntro: number | null;
  confermatoIl: number | null;
  retrocessoIl: number | null;
  scadenzaAvvisata?: number;
}

// attivita_cambiata: chi si iscrive aveva visto l'attività prima di una modifica maggiore
export type MotivoRifiuto = 'inesistente' | 'annullata' | 'iniziata' | 'attivita_cambiata';

export type EsitoIscrizione =
  | { esito: 'confermato' }
  | { esito: 'in_attesa'; posizione: number; motivo: string }
  | { esito: 'da_confermare'; entro: number }
  | { esito: 'rifiutato'; motivo: MotivoRifiuto };

// Lo stato di chi chiede: posizione e motivo li conosce solo l'API
export type StatoIscrizione =
  | { stato: 'non_iscritto' }
  | { stato: 'confermato' }
  | { stato: 'in_attesa'; posizione: number; motivo: string }
  | { stato: 'da_confermare'; entro: number };

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

export const SOGLIA_MINUTI = 30;

// Tempo per riconfermare dopo una modifica maggiore
export const RICONFERMA_ORE = 24;
export const RAGGIO_VICINO_KM = 2;

export interface Punto {
  lat: number;
  lon: number;
}

// Distanza in linea d'aria fra due punti
export function distanzaKm(a: Punto, b: Punto) {
  const RAGGIO_TERRA = 6371;
  const radianti = (gradi: number) => (gradi * Math.PI) / 180;
  const dLat = radianti(b.lat - a.lat);
  const dLon = radianti(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(radianti(a.lat)) * Math.cos(radianti(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * RAGGIO_TERRA * Math.asin(Math.sqrt(h));
}

// Con le coordinate conta il punto
export function stessoLuogo(a: Luogo, b: Luogo) {
  const coordinate = (l: Luogo) => l.lat !== undefined && l.lon !== undefined;
  if (coordinate(a) && coordinate(b)) return a.lat === b.lat && a.lon === b.lon;
  return a.testo === b.testo;
}

type Quando = Pick<Attivita, 'inizio' | 'durataMinuti' | 'luogo'>;

// La stessa funzione decide nell'API e avvisa nel browser prima dell'invio
export function entitaModifica(prima: Quando, dopo: Quando): EntitaModifica {
  const minuto = 60 * 1000;
  const fine = (q: Quando) => q.inizio + q.durataMinuti * minuto;
  const soglia = SOGLIA_MINUTI * minuto;
  const minore =
    Math.abs(dopo.inizio - prima.inizio) <= soglia &&
    Math.abs(fine(dopo) - fine(prima)) <= soglia &&
    stessoLuogo(prima.luogo, dopo.luogo);
  return minore ? 'minore' : 'maggiore';
}

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

// Lo stesso luogo deve dare la stessa chiave anche se scritto in modi diversi
export function chiaveLuogo(luogo: Luogo) {
  if (luogo.lat !== undefined && luogo.lon !== undefined) {
    const intero = (gradi: number) => Math.round(gradi * 10000);
    return `geo:${intero(luogo.lat)},${intero(luogo.lon)}`;
  }
  return luogo.testo.trim().toLowerCase().replace(/\s+/g, ' ');
}

export interface Statistiche {
  partecipazioni: number;
  ultimaPartecipazione: number | null;
  escluso: number;
  perCategoria: Partial<Record<Categoria, number>>;
  perLuogo: Record<string, number>;
  // Quante volte ha partecipato con ciascun altro utente: una scrittura per persona a consolidamento.
  coPartecipanti: Record<string, number>;
}
export interface Notifica {
  titolo: string;
  testo: string;
  indirizzo: string;
  etichetta: string;
}

export interface Sottoscrizione {
  endpoint: string;
  chiavi: { p256dh: string; auth: string };
  creataIl: number;
}

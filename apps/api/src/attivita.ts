import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  CATEGORIE,
  COLLEZIONI,
  DURATA_MASSIMA,
  DURATA_MINIMA,
  LUNGHEZZA_MASSIMA,
  POLITICHE,
  SOTTOCOLLEZIONI,
  type Attivita,
  type Evento,
  type Luogo,
  type NuovaAttivita,
  type Partecipante,
} from 'modello';
import { db } from './firestore.js';

type Esito<T> = { ok: true; valore: T } | { ok: false; errori: string[] };

function testo(valore: unknown, massimo: number, obbligatorio = true) {
  if (typeof valore !== 'string') return null;
  const pulito = valore.trim();
  if (obbligatorio && pulito.length === 0) return null;
  return pulito.length <= massimo ? pulito : null;
}

function intero(valore: unknown, minimo: number, massimo: number) {
  return Number.isInteger(valore) && (valore as number) >= minimo && (valore as number) <= massimo
    ? (valore as number)
    : null;
}

function luogo(valore: unknown): Luogo | null {
  if (typeof valore !== 'object' || valore === null) return null;
  const { testo: t, civico, nome, lat, lon } = valore as Record<string, unknown>;

  const descrizione = testo(t, LUNGHEZZA_MASSIMA.luogo);
  if (descrizione === null) return null;

  const risultato: Luogo = { testo: descrizione };
  if (civico !== undefined) {
    const c = testo(civico, LUNGHEZZA_MASSIMA.civico);
    if (c === null) return null;
    risultato.civico = c;
  }
  if (nome !== undefined) {
    const n = testo(nome, 300);
    if (n === null) return null;
    risultato.nome = n;
  }

  // Coordinate entrambe o nessuna: una sola non indica un punto.
  if (lat === undefined && lon === undefined) return risultato;
  if (typeof lat !== 'number' || typeof lon !== 'number') return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { ...risultato, lat, lon };
}

type Validatore<T> = (valore: unknown, adesso: number) => T | null;

// Una regola per campo
const validatori: { [C in keyof NuovaAttivita]: Validatore<NuovaAttivita[C]> } = {
  titolo: (v) => testo(v, LUNGHEZZA_MASSIMA.titolo),
  descrizione: (v) => testo(v ?? '', LUNGHEZZA_MASSIMA.descrizione, false),
  categoria: (v) => CATEGORIE.find((c) => c === v) ?? null,
  inizio: (v, adesso) => (typeof v === 'number' && v > adesso ? v : null),
  durataMinuti: (v) => intero(v, DURATA_MINIMA, DURATA_MASSIMA),
  luogo,
  capacita: (v) => intero(v, CAPACITA_MINIMA, CAPACITA_MASSIMA),
  politicaCoda: (v) => POLITICHE.find((p) => p === (v ?? 'fifo')) ?? null,
};

// Costruisce il valore campo per campo
function valida<C extends keyof NuovaAttivita>(d: Record<string, unknown>, campi: readonly C[], adesso: number) {
  const errori: string[] = [];
  const valore: Partial<NuovaAttivita> = {};
  for (const campo of campi) {
    const pulito = validatori[campo](d[campo], adesso);
    if (pulito === null) errori.push(campo);
    else valore[campo] = pulito;
  }
  return { errori, valore: valore as Pick<NuovaAttivita, C> };
}

export function validaNuovaAttivita(dati: unknown, adesso = Date.now()): Esito<NuovaAttivita> {
  if (typeof dati !== 'object' || dati === null) return { ok: false, errori: ['corpo'] };
  const campi = Object.keys(validatori) as (keyof NuovaAttivita)[];
  const { errori, valore } = valida(dati as Record<string, unknown>, campi, adesso);
  return errori.length > 0 ? { ok: false, errori } : { ok: true, valore };
}

export const CAMPI_MODIFICABILI = [
  'titolo',
  'descrizione',
  'categoria',
  'capacita',
  'inizio',
  'durataMinuti',
  'luogo',
  'politicaCoda',
] as const;

export type Modifica = Partial<Pick<NuovaAttivita, (typeof CAMPI_MODIFICABILI)[number]>>;

export function validaModifica(dati: unknown): Esito<Modifica> {
  if (typeof dati !== 'object' || dati === null) return { ok: false, errori: ['corpo'] };
  const d = dati as Record<string, unknown>;
  const presenti = CAMPI_MODIFICABILI.filter((c) => d[c] !== undefined);
  if (presenti.length === 0) return { ok: false, errori: ['nessun_campo'] };
  const { errori, valore } = valida(d, presenti, Date.now());
  return errori.length > 0 ? { ok: false, errori } : { ok: true, valore };
}

export async function creaAttivita(organizzatore: string, nuova: NuovaAttivita, adesso = Date.now()) {
  const riferimento = db.collection(COLLEZIONI.attivita).doc();

  const attivita: Attivita = {
    ...nuova,
    postiOccupati: 1,
    inAttesa: 0,
    daConfermare: 0,
    organizzatore,
    stato: 'aperta',
    versione: 1,
    versioneMaggiore: 1,
    creataIl: adesso,
    modificataIl: adesso,
    consolidataIl: null,
  };
  // L'organizzatore partecipa
  const iscrizione: Partecipante = {
    stato: 'confermato',
    iscrittoIl: adesso,
    versioneAccettata: 1,
    confermaEntro: null,
    confermatoIl: adesso,
    retrocessoIl: null,
  };
  const creata: Evento = { tipo: 'creata', utente: organizzatore, quando: adesso, versione: 1 };
  const iscritto: Evento = { ...creata, tipo: 'iscritto' };

  // Un batch basta: il documento è nuovo, nessuno può contenderlo.
  const eventi = riferimento.collection(SOTTOCOLLEZIONI.eventi);
  const batch = db.batch();
  batch.set(riferimento, attivita);
  batch.set(riferimento.collection(SOTTOCOLLEZIONI.partecipanti).doc(organizzatore), iscrizione);
  batch.set(eventi.doc(), creata);
  batch.set(eventi.doc(), iscritto);
  await batch.commit();

  return riferimento.id;
}

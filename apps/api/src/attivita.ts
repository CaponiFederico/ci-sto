import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  CATEGORIE,
  COLLEZIONI,
  POLITICHE,
  SOTTOCOLLEZIONI,
  type Attivita,
  type Evento,
  type Luogo,
  type NuovaAttivita,
  type Partecipante,
} from 'modello';
import { db } from './firestore.js';

export const DURATA_MINIMA = 15;
export const DURATA_MASSIMA = 24 * 60;

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
  const { testo: t, nome, lat, lon } = valore as Record<string, unknown>;

  const descrizione = testo(t, 200);
  if (descrizione === null) return null;

  const risultato: Luogo = { testo: descrizione };
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

// Costruisce il valore campo per campo: ciò che il client aggiunge non arriva nel documento.
export function validaNuovaAttivita(dati: unknown, adesso = Date.now()): Esito<NuovaAttivita> {
  if (typeof dati !== 'object' || dati === null) return { ok: false, errori: ['corpo'] };
  const d = dati as Record<string, unknown>;
  const errori: string[] = [];

  const titolo = testo(d.titolo, 120);
  if (titolo === null) errori.push('titolo');

  const descrizione = testo(d.descrizione ?? '', 2000, false);
  if (descrizione === null) errori.push('descrizione');

  const categoria = CATEGORIE.find((c) => c === d.categoria);
  if (!categoria) errori.push('categoria');

  const inizio = typeof d.inizio === 'number' && d.inizio > adesso ? d.inizio : null;
  if (inizio === null) errori.push('inizio');

  const durataMinuti = intero(d.durataMinuti, DURATA_MINIMA, DURATA_MASSIMA);
  if (durataMinuti === null) errori.push('durataMinuti');

  const dove = luogo(d.luogo);
  if (dove === null) errori.push('luogo');

  const capacita = intero(d.capacita, CAPACITA_MINIMA, CAPACITA_MASSIMA);
  if (capacita === null) errori.push('capacita');

  const politicaCoda = POLITICHE.find((p) => p === (d.politicaCoda ?? 'fifo'));
  if (!politicaCoda) errori.push('politicaCoda');

  if (errori.length > 0) return { ok: false, errori };

  return {
    ok: true,
    valore: {
      titolo: titolo!,
      descrizione: descrizione!,
      categoria: categoria!,
      inizio: inizio!,
      durataMinuti: durataMinuti!,
      luogo: dove!,
      capacita: capacita!,
      politicaCoda: politicaCoda!,
    },
  };
}

export async function creaAttivita(organizzatore: string, nuova: NuovaAttivita, adesso = Date.now()) {
  const riferimento = db.collection(COLLEZIONI.attivita).doc();

  const attivita: Attivita = {
    ...nuova,
    postiOccupati: 1,
    inAttesa: 0,
    organizzatore,
    stato: 'aperta',
    versione: 1,
    creataIl: adesso,
    modificataIl: adesso,
  };
  // L'organizzatore partecipa
  const iscrizione: Partecipante = {
    stato: 'confermato',
    iscrittoIl: adesso,
    punteggio: 0,
    versioneAccettata: 1,
    confermaEntro: null,
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

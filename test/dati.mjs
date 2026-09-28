import './emulatore.mjs';

import { creaAttivita, validaNuovaAttivita } from '../apps/api/dist/attivita.js';

export const ADESSO = Date.UTC(2026, 9, 1, 12, 0);
export const DOMANI = ADESSO + 24 * 60 * 60 * 1000;

export const attivitaValida = {
  titolo: 'Calcetto',
  descrizione: 'Cerco otto persone',
  categoria: 'sport',
  inizio: DOMANI,
  durataMinuti: 90,
  luogo: { testo: 'Campo CUS', lat: 43.7169, lon: 10.3917 },
  capacita: 8,
  politicaCoda: 'fifo',
};

// Passa dalla validazione 
export async function attivitaDiProva(modifiche = {}, organizzatore = 'manuela') {
  const esito = validaNuovaAttivita({ ...attivitaValida, ...modifiche }, ADESSO);
  if (!esito.ok) throw new Error(`attività di prova non valida: ${esito.errori.join(', ')}`);
  return creaAttivita(organizzatore, esito.valore, ADESSO);
}

export function studenti(quanti) {
  return Array.from({ length: quanti }, (_, i) => `studente-${i + 1}`);
}

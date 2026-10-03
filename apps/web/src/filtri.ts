import type { Categoria, StatoPartecipante } from 'modello';
import type { AttivitaConId } from './dati';

export type Mostra = 'tutte' | 'mie' | 'organizzo' | 'libere';

// Per te
export type Ordine = 'per_te' | 'data';

export interface Filtri {
  categoria: Categoria | 'tutte';
  mostra: Mostra;
  ordine: Ordine;
}

export const FILTRI_INIZIALI: Filtri = { categoria: 'tutte', mostra: 'tutte', ordine: 'per_te' };

// Il mio stato in ogni attività dell'elenco
export type MieiStati = Record<string, StatoPartecipante | undefined>;

// Si filtra sui documenti già scaricati
export function filtra(elenco: AttivitaConId[], filtri: Filtri, uid: string, stati: MieiStati, adesso: number) {
  return elenco.filter((a) => {
    if (filtri.categoria !== 'tutte' && a.categoria !== filtri.categoria) return false;

    switch (filtri.mostra) {
      case 'tutte':
        return true;
      case 'mie':
        return stati[a.id] !== undefined;
      case 'organizzo':
        return a.organizzatore === uid;
      case 'libere':
        return a.stato !== 'annullata' && a.inizio > adesso && a.postiOccupati < a.capacita;
    }
  });
}

import type { Attivita, Categoria } from 'modello';

export const CATEGORIA: Record<Categoria, string> = {
  sport: 'Sport',
  studio: 'Studio',
  trasporto: 'Trasporto',
  svago: 'Svago',
  altro: 'Altro',
};

export function quando(istante: number) {
  return new Date(istante).toLocaleString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function posti({ stato, capacita, postiOccupati, inAttesa }: Attivita) {
  if (stato === 'annullata') return 'Annullata';

  const liberi = capacita - postiOccupati;
  if (liberi > 0) return `${liberi} ${liberi === 1 ? 'posto libero' : 'posti liberi'} su ${capacita}`;
  return inAttesa > 0 ? `Posti finiti, ${inAttesa} in lista d’attesa` : 'Posti finiti';
}

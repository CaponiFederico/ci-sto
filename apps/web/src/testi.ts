import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  DURATA_MINIMA,
  LUNGHEZZA_MASSIMA,
  type Attivita,
  type Categoria,
  type Evento,
  type PoliticaCoda,
} from 'modello';
import type { Campo } from './modulo';

export const CATEGORIA: Record<Categoria, string> = {
  sport: 'Sport',
  studio: 'Studio',
  trasporto: 'Trasporto',
  svago: 'Svago',
  altro: 'Altro',
};

export const POLITICA: Record<PoliticaCoda, { nome: string; regola: string }> = {
  fifo: { nome: 'Ordine d’arrivo', regola: 'chi si è messo in lista prima' },
  affinita: { nome: 'Affinità', regola: 'chi ha già partecipato più volte con chi ha il posto' },
  esplorazione: { nome: 'Esplorazione', regola: 'chi conosce meno il gruppo' },
  rotazione: { nome: 'Rotazione', regola: 'chi non partecipa da più tempo' },
  equita: { nome: 'Equità', regola: 'chi è rimasto escluso più volte' },
};

export const ERRORE_CAMPO: Record<Campo, string> = {
  titolo: `Serve un titolo, al massimo ${LUNGHEZZA_MASSIMA.titolo} caratteri.`,
  descrizione: `La descrizione supera i ${LUNGHEZZA_MASSIMA.descrizione} caratteri.`,
  categoria: 'Scegli una categoria.',
  inizio: 'L’inizio deve essere nel futuro.',
  durataMinuti: `La durata va da ${DURATA_MINIMA} minuti a 24 ore.`,
  luogo: `Indica dove ci si trova, al massimo ${LUNGHEZZA_MASSIMA.luogo} caratteri.`,
  capacita: `I posti vanno da ${CAPACITA_MINIMA} a ${CAPACITA_MASSIMA}, te compreso.`,
  politicaCoda: 'Scegli come funziona la lista d’attesa.',
};

const NOME_CAMPO: Record<Campo, string> = {
  titolo: 'titolo',
  descrizione: 'descrizione',
  categoria: 'categoria',
  inizio: 'inizio',
  durataMinuti: 'durata',
  luogo: 'luogo',
  capacita: 'posti',
  politicaCoda: 'lista d’attesa',
};

export function voceCronologia({ tipo, campiModificati = [], entita }: Evento) {
  if (tipo === 'creata') return 'Pubblicata';
  if (tipo === 'annullata') return 'Annullata';

  const campi = campiModificati.map((c) => NOME_CAMPO[c as Campo] ?? c).join(', ');
  return entita === 'maggiore' ? `Modificata: ${campi}. Chi era iscritto deve riconfermare` : `Modificata: ${campi}`;
}

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

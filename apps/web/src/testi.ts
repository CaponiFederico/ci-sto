import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  DURATA_MINIMA,
  LUNGHEZZA_MASSIMA,
  type Attivita,
  type Categoria,
  RICONFERMA_ORE,
  type EsitoAnnullamento,
  type EsitoIscrizione,
  type EsitoModifica,
  type EsitoRiconferma,
  type EsitoUscita,
  type Evento,
  type MotivoRifiuto,
  type MotivoRifiutoAnnullamento,
  type MotivoRifiutoModifica,
  type MotivoRifiutoRiconferma,
  type MotivoRifiutoUscita,
  type PoliticaCoda,
  type StatoIscrizione,
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

type Azione = 'iscrivi' | 'lascia' | 'riconferma';

export interface Iscrizione {
  testo: string;
  // Il primo è l'azione principale.
  bottoni: { azione: Azione; testo: string }[];
}

export function descriviIscrizione(stato: StatoIscrizione, attivita: Attivita, adesso: number): Iscrizione {
  switch (stato.stato) {
    case 'non_iscritto':
      return attivita.postiOccupati < attivita.capacita
        ? { testo: 'Non sei iscritto.', bottoni: [{ azione: 'iscrivi', testo: 'Iscriviti' }] }
        : {
            testo: 'I posti sono finiti: puoi metterti in lista d’attesa.',
            bottoni: [{ azione: 'iscrivi', testo: 'Mettiti in lista' }],
          };
    case 'confermato':
      return { testo: 'Hai un posto.', bottoni: [{ azione: 'lascia', testo: 'Lascia il posto' }] };
    case 'in_attesa':
      return {
        testo: `Sei in lista d’attesa, in posizione ${stato.posizione}: ${stato.motivo}.`,
        bottoni: [{ azione: 'lascia', testo: 'Esci dalla lista' }],
      };
    case 'da_confermare':
      // La scadenza sul server è pigra: finché nessuno la applica, la calcola chi guarda.
      return stato.entro <= adesso
        ? {
            testo: 'Il termine per riconfermare è passato: il posto non è più tuo.',
            bottoni: [{ azione: 'iscrivi', testo: 'Iscriviti di nuovo' }],
          }
        : {
            testo: `L’attività è cambiata: il posto resta tuo se lo riconfermi entro ${quando(stato.entro)}.`,
            bottoni: [
              { azione: 'riconferma', testo: 'Riconfermo' },
              { azione: 'lascia', testo: 'Lascia il posto' },
            ],
          };
  }
}

const RIFIUTO_ISCRIZIONE: Record<MotivoRifiuto, string> = {
  inesistente: 'Questa attività non esiste più.',
  annullata: 'L’attività è stata annullata.',
  iniziata: 'L’attività è già cominciata: le iscrizioni sono chiuse.',
};

const RIFIUTO_USCITA: Record<MotivoRifiutoUscita, string> = {
  annullata: 'L’attività è stata annullata.',
  iniziata: 'L’attività è già cominciata.',
  organizzatore: 'Chi organizza non può lasciare: può annullare l’attività.',
};

export function avvisoIscrizione(esito: EsitoIscrizione): string | null {
  switch (esito.esito) {
    case 'confermato':
    case 'in_attesa':
    case 'da_confermare':
      return null;
    case 'rifiutato':
      return RIFIUTO_ISCRIZIONE[esito.motivo];
  }
}

export function avvisoUscita(esito: EsitoUscita): string | null {
  switch (esito.esito) {
    case 'uscito':
    case 'non_iscritto':
      return null;
    case 'rifiutato':
      return RIFIUTO_USCITA[esito.motivo];
  }
}

const RIFIUTO_RICONFERMA: Record<MotivoRifiutoRiconferma, string> = {
  inesistente: 'Questa attività non esiste più.',
  annullata: 'L’attività è stata annullata.',
  non_iscritto: 'Non risulti più iscritto.',
  in_coda: 'Sei in lista d’attesa: non c’è un posto da riconfermare.',
  scaduta: 'Il termine per riconfermare è passato.',
};

export function avvisoRiconferma(esito: EsitoRiconferma): string | null {
  switch (esito.esito) {
    case 'confermato':
      return null;
    case 'rifiutato':
      return RIFIUTO_RICONFERMA[esito.motivo];
  }
}

const persone = (n: number) => (n === 1 ? '1 persona' : `${n} persone`);

// La domanda che il browser pone prima di inviare una modifica maggiore
export function domandaMaggiore(altri: number) {
  return `Stai cambiando orario o luogo in modo importante: ${persone(altri)} con un posto ${
    altri === 1 ? 'dovrà' : 'dovranno'
  } riconfermarlo entro ${RICONFERMA_ORE} ore, altrimenti lo ${altri === 1 ? 'perde' : 'perdono'}. Confermi?`;
}

const RIFIUTO_MODIFICA: Record<MotivoRifiutoModifica, string> = {
  inesistente: 'Questa attività non esiste più.',
  non_organizzatore: 'Solo chi organizza può modificare l’attività.',
  annullata: 'L’attività è stata annullata: non si può più modificare.',
  iniziata: 'L’attività è già cominciata: non si può più modificare.',
  coda_non_vuota: 'La regola della lista d’attesa si può cambiare solo quando la lista è vuota.',
};

// Ogni esito della modifica ha la sua frase
export function messaggioModifica(esito: EsitoModifica): string {
  switch (esito.esito) {
    case 'invariata':
      return 'Nessuna modifica: i dati sono uguali a prima.';
    case 'conferma_richiesta':
      return `Riducendo i posti, ${persone(esito.retrocessi)} ${
        esito.retrocessi === 1 ? 'perde il posto e passa' : 'perdono il posto e passano'
      } in testa alla lista d’attesa. Confermi?`;
    case 'rifiutato':
      return RIFIUTO_MODIFICA[esito.motivo];
    case 'modificata': {
      const frasi = ['Modifica salvata.'];
      if (esito.promossi.length > 0) frasi.push(`Dalla lista d’attesa: ${persone(esito.promossi.length)} con un posto.`);
      if (esito.retrocessi.length > 0) frasi.push(`In testa alla lista d’attesa: ${persone(esito.retrocessi.length)}.`);
      if (esito.daConfermare.length > 0) {
        frasi.push(`Da riconfermare entro ${RICONFERMA_ORE} ore: ${persone(esito.daConfermare.length)}.`);
      }
      return frasi.join(' ');
    }
  }
}

const RIFIUTO_ANNULLAMENTO: Record<MotivoRifiutoAnnullamento, string> = {
  inesistente: 'Questa attività non esiste più.',
  non_organizzatore: 'Solo chi organizza può annullare l’attività.',
  iniziata: 'L’attività è già cominciata: non si può più annullare.',
};

export function avvisoAnnullamento(esito: EsitoAnnullamento): string | null {
  switch (esito.esito) {
    case 'annullata':
      return null;
    case 'rifiutato':
      return RIFIUTO_ANNULLAMENTO[esito.motivo];
  }
}

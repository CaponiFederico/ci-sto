import {
  CAPACITA_MASSIMA,
  CAPACITA_MINIMA,
  DURATA_MINIMA,
  LUNGHEZZA_MASSIMA,
  RAGGIO_VICINO_KM,
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
  type Luogo,
  type PoliticaCoda,
  type StatoPartecipante,
} from 'modello';
import type { MioStato } from './dati';
import type { Mostra, Ordine } from './filtri';
import type { Campo } from './modulo';
import type { Motivo } from './ordine';
import type { StatoPosizione } from './posizione';
import type { AzioneSospesa } from './sospese';

export const CATEGORIA: Record<Categoria, string> = {
  sport: 'Sport',
  studio: 'Studio',
  trasporto: 'Trasporto',
  svago: 'Svago',
  altro: 'Altro',
};

export const MOSTRA: Record<Mostra, string> = {
  tutte: 'Tutte',
  mie: 'A cui partecipo',
  organizzo: 'Organizzate da me',
  libere: 'Con posti liberi',
  vicine: `Vicino a me (entro ${RAGGIO_VICINO_KM} km)`,
};

export const ORDINE: Record<Ordine, string> = {
  per_te: 'Per te',
  data: 'Per data',
};

// Perché un'attività sta in alto
export function motivoOrdine(motivo: Motivo) {
  const n = motivo.quanti;
  switch (motivo.segnale) {
    case 'persone':
      return n === 1
        ? 'Con 1 persona con cui hai già partecipato'
        : `Con ${n} persone con cui hai già partecipato`;
    case 'categoria':
      return n === 1
        ? 'Hai già partecipato 1 volta ad attività di questa categoria'
        : `Hai già partecipato ${n} volte ad attività di questa categoria`;
    case 'luogo':
      return n === 1 ? 'Sei già stato qui 1 volta' : `Sei già stato qui ${n} volte`;
    case 'vicinanza':
      return `A${aDistanza(n).slice(1)} da te`;
  }
}

export const SENZA_POSIZIONE =
  'L’ordine non tiene conto della distanza: per usarla imposta «La mia posizione» qui sopra.';

export const SENZA_STORICO =
  'Non hai ancora partecipato a nessuna attività: per ora l’ordine è quello per data.';

export const MIO_STATO: Record<StatoPartecipante, string> = {
  confermato: 'Partecipi',
  in_attesa: 'Sei in lista d’attesa',
  da_confermare: 'Da riconfermare',
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

export function indirizzo(luogo: Luogo) {
  const { nome, civico } = luogo;
  if (!nome) return civico ? `Civico ${civico}` : null;
  return civico && !nome.split(', ').includes(civico) ? `${nome} (civico ${civico})` : nome;
}

// Apre il navigatore sul punto
export function apriNelleMappe(lat: number, lon: number) {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}

export function aDistanza(km: number) {
  const metri = Math.max(50, Math.round((km * 1000) / 50) * 50);
  if (metri < 1000) return `a ${metri} m`;
  const decimo = Math.round(km * 10) / 10;
  return `a ${decimo < 10 ? decimo.toFixed(1).replace('.', ',') : Math.round(km)} km`;
}

export const POSIZIONE: Record<Exclude<StatoPosizione, 'nota'>, string> = {
  ignota: 'Quanto dista?',
  in_corso: 'Rilevo la posizione…',
  negata: 'Non hai concesso la posizione.',
  non_disponibile: 'La posizione non è disponibile su questo dispositivo.',
};

export const MIA_POSIZIONE = {
  titolo: 'La mia posizione',
  assente: 'non impostata',
  rilevata: 'dal dispositivo',
  scelta: 'un indirizzo scelto',
  aCosaServe:
    'Serve per calcolare la distanza tra questo dispositivo e le attività. Puoi usare la posizione del dispositivo o scegliere un indirizzo.',
  dalDispositivo: 'Uso la posizione del dispositivo.',
  usa: 'Usa la posizione del dispositivo',
  aMano: 'Non puoi o non vuoi usare la posizione del dispositivo?',
  etichetta: 'Indirizzo da cui calcolare le distanze',
};

export const VICINE = {
  senza: 'Per vedere le attività vicine serve la tua posizione: usa quella del dispositivo o scegli un indirizzo qui sotto.',
  nota: `Solo le attività con un indirizzo, entro ${RAGGIO_VICINO_KM} km in linea d’aria.`,
};

export const NOTIFICHE = {
  attiva: 'Attiva le notifiche',
  proposta: 'Vuoi essere avvisato se qui cambia qualcosa?',
  attive: 'Notifiche attive su questo dispositivo.',
  disattiva: 'Disattiva',
  prova: 'Mandane una di prova',
  provaInviata: 'Inviata.',
  provaFallita: 'Non inviata.',
  negate: 'Le notifiche sono bloccate dal browsera.',
  errore: 'Non è stato possibile completare l’operazione. Riprova.',
  servizio:
    'Il permesso c’è, ma il browser non riesce a registrarsi al suo servizio di notifiche.',
};

export const MAPPA = {
  corta: 'Almeno 3 caratteri,',
  nessuno: 'Nessun risultato. Prova a scriverlo in un altro modo, oppure pubblica senza indirizzo.',
  nonDisponibile: 'La ricerca non è disponibile in questo momento: puoi pubblicare lo stesso.',
  rinominato: 'Hai cambiato il luogo: se è un altro posto, cerca il nuovo indirizzo o togli questo.',
  attribuzione: 'Risultati © OpenStreetMap',
  qui: 'Usa la mia posizione',
  quiInCorso: 'Cerco l’indirizzo…',
  quiNegata:
    'Il browser non ha il permesso di usare la posizione. Concedilo dalle impostazioni del sito, accanto all’indirizzo della pagina, oppure cerca l’indirizzo scrivendolo.',
  quiNessuno: 'Non trovo un indirizzo per questa posizione: prova a cercarlo scrivendolo.',
  aiutoLuogo: 'Il nome con cui lo conosce chi ci va: «Aula A1», «Campi da calcetto CUS».',
  aiutoIndirizzo:
    'L’indirizzo reale per rendere il luogo facilmente raggiungibile: «Via Roma 1, Torino», «Piazza del Duomo, Milano».',
  indicativa: 'La posizione sulla mappa è indicativa: può non coincidere con l’ingresso o con il civico.',
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

export function descriviIscrizione(stato: MioStato, attivita: Attivita, adesso: number): Iscrizione {
  switch (stato.stato) {
    case 'non_iscritto':
      return attivita.postiOccupati < attivita.capacita
        ? { testo: 'Non sei iscritto.', bottoni: [{ azione: 'iscrivi', testo: 'Iscriviti' }] }
        : {
            testo: 'I posti sono finiti: puoi metterti in lista d’attesa.',
            bottoni: [{ azione: 'iscrivi', testo: 'Mettiti in lista' }],
          };
    case 'confermato':
      return { testo: 'Partecipi.', bottoni: [{ azione: 'lascia', testo: 'Lascia il posto' }] };
    case 'in_attesa':
      return {
        // Senza rete posizione e motivo mancano
        testo: stato.coda
          ? `Sei in lista d’attesa, in posizione ${stato.coda.posizione}: ${stato.coda.motivo}.`
          : 'Sei in lista d’attesa.',
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
  attivita_cambiata: 'L’attività è stata modificata mentre la guardavi: controlla orario e luogo, poi riprova.',
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

// In sospeso
export const SOSPESA: Record<AzioneSospesa, string> = {
  iscrivi: 'Iscrizione in sospeso: partirà quando torna la rete. Non hai ancora un posto.',
  lascia: 'Uscita in sospeso: partirà quando torna la rete. Fino ad allora risulti ancora iscritto.',
  riconferma: 'Riconferma in sospeso: partirà quando torna la rete, e vale solo se arriva prima della scadenza.',
};

export function inSospeso(quante: number) {
  return quante === 1
    ? '1 richiesta in sospeso: partirà quando torna la rete.'
    : `${quante} richieste in sospeso: partiranno quando torna la rete.`;
}

export function domandaUscita(quante: number) {
  return quante === 1
    ? 'Hai 1 richiesta in sospeso: uscendo non partirà più. Vuoi uscire lo stesso?'
    : `Hai ${quante} richieste in sospeso: uscendo non partiranno più. Vuoi uscire lo stesso?`;
}

export const CAMBIATA_IN_SOSPESO = 'Mentre la richiesta era in sospeso l’attività è stata modificata: aprila per decidere.';

// Che cosa è cambiato dopo la versione che la persona aveva visto
export function cambiataDa(eventi: Evento[], versioneVista: number) {
  const toccati = eventi
    .filter((e) => e.tipo === 'modificata' && e.versione > versioneVista)
    .flatMap((e) => e.campiModificati ?? []);
  const nomi = [...new Set(toccati)].map((c) => NOME_CAMPO[c as Campo] ?? c).join(', ');

  return `Mentre la tua richiesta era in sospeso l’attività è stata modificata${
    nomi ? ` (${nomi})` : ''
  }. Controlla i dati qui sopra: vuoi iscriverti lo stesso?`;
}

// Una richiesta in coda
export type StatoSospesa = 'attesa' | 'cambiata' | 'rifiutata';

export const ETICHETTA_SOSPESA: Record<StatoSospesa, string> = {
  attesa: 'Richiesta in sospeso',
  cambiata: 'Richiesta da confermare',
  rifiutata: 'Richiesta non accolta',
};

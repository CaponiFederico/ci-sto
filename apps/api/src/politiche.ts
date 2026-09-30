import type { PoliticaCoda, Statistiche } from 'modello';

export interface Contesto {
  // Chi ha già il posto
  presenti: string[];
  statistiche: Map<string, Statistiche>;
  adesso: number;
}

export interface Valutazione {
  // Più alto passa primaù
  // a parità chi arriva prima
  punteggio: number;
  // Lo legge solo il diretto interessato
  motivo: string;
}

type Politica = (uid: string, contesto: Contesto) => Valutazione;

const GIORNO = 24 * 60 * 60 * 1000;
const MAI = Number.MAX_SAFE_INTEGER;

const volte = (n: number) => (n === 1 ? '1 volta' : `${n} volte`);

function statisticheDi(uid: string, contesto: Contesto) {
  return contesto.statistiche.get(uid);
}

// Quante volte ha già partecipato con chi ha il posto
function conosciuti(uid: string, contesto: Contesto) {
  const co = statisticheDi(uid, contesto)?.coPartecipanti ?? {};
  return contesto.presenti.reduce((somma, altro) => somma + (co[altro] ?? 0), 0);
}

const fifo: Politica = () => ({ punteggio: 0, motivo: "in ordine d'arrivo" });

const affinita: Politica = (uid, contesto) => {
  const n = conosciuti(uid, contesto);
  return {
    punteggio: n,
    motivo: n === 0 ? "non hai ancora partecipato con chi è presente nell'attività" : `hai già partecipato ${volte(n)} con chi è presente nell'attività`,
  };
};

const esplorazione: Politica = (uid, contesto) => {
  const n = conosciuti(uid, contesto);
  return {
    punteggio: -n,
    motivo:
      n === 0
        ? "non hai ancora partecipato con chi c'è"
        : `hai già partecipato ${volte(n)} con chi c'è: passa prima chi conosce meno il gruppo`,
  };
};

const rotazione: Politica = (uid, contesto) => {
  const ultima = statisticheDi(uid, contesto)?.ultimaPartecipazione ?? null;
  if (ultima === null) return { punteggio: MAI, motivo: 'non hai ancora partecipato a nessuna attività' };
  const giorni = Math.floor((contesto.adesso - ultima) / GIORNO);
  return {
    punteggio: contesto.adesso - ultima,
    motivo: giorni === 0 ? 'hai partecipato oggi' : `non partecipi da ${giorni === 1 ? '1 giorno' : `${giorni} giorni`}`,
  };
};

const equita: Politica = (uid, contesto) => {
  const n = statisticheDi(uid, contesto)?.escluso ?? 0;
  return {
    punteggio: n,
    motivo: n === 0 ? 'nessuna esclusione in passato' : `${n === 1 ? '1 esclusione' : `${n} esclusioni`} in passato`,
  };
};

// cambiare politica cambia solo quale funzione si chiama
export const POLITICA: Record<PoliticaCoda, Politica> = { fifo, affinita, esplorazione, rotazione, equita };

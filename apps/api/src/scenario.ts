import type { Categoria, PoliticaCoda } from 'modello';
import { creaAttivita, validaNuovaAttivita } from './attivita.js';
import { esci, iscrivi } from './iscrizioni.js';
import { modificaAttivita } from './modifiche.js';
import { consolidaAttivita } from './storico.js';

const MINUTO = 60 * 1000;
const GIORNO = 24 * 60 * MINUTO;

export const POLITICHE: PoliticaCoda[] = ['fifo', 'affinita', 'esplorazione', 'rotazione', 'equita'];
export const IN_CODA = ['carla', 'dario', 'elena', 'franco', 'giulia', 'luca'];

export interface Riga {
  posizione: number;
  uid: string;
  motivo: string;
}

interface Scheda {
  titolo: string;
  categoria: Categoria;
  luogo: string;
  capacita: number;
  organizzatore: string;
  inizio: number;
  politicaCoda?: PoliticaCoda;
}

// Uno storico 
export async function popolaStorico(oggi: number): Promise<Record<PoliticaCoda, Riga[]>> {
  let tempo = oggi;
  const orologio = () => tempo;
  const giorniFa = (n: number) => oggi - n * GIORNO;

  async function crea(s: Scheda) {
    tempo = Math.min(s.inizio - 2 * GIORNO, oggi);
    const dati = {
      titolo: s.titolo,
      categoria: s.categoria,
      inizio: s.inizio,
      durataMinuti: 90,
      luogo: { testo: s.luogo },
      capacita: s.capacita,
      politicaCoda: s.politicaCoda ?? 'fifo',
    };
    const esito = validaNuovaAttivita(dati, tempo);
    if (!esito.ok) throw new Error(`${s.titolo}: ${esito.errori.join(', ')}`);
    return creaAttivita(s.organizzatore, esito.valore, tempo);
  }

  async function iscrivili(id: string, uid: string[]) {
    for (const u of uid) {
      tempo += MINUTO;
      await iscrivi(id, u, orologio);
    }
  }

  // attività passata
  async function passata(s: Scheda, iscritti: string[], nelFrattempo?: (id: string) => Promise<unknown>) {
    const id = await crea(s);
    await iscrivili(id, iscritti);
    tempo += MINUTO;
    await nelFrattempo?.(id);
    tempo = s.inizio;
    await consolidaAttivita(id, orologio);
  }

  // Anna, bruno e carla partecipano sempre insieme, dario resta spesso fuori,
  // giulia, luca e franco sono un altro giro, elena rinuncia una volta
  await passata(
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'Campo CUS', capacita: 4, organizzatore: 'manuela', inizio: giorniFa(40) },
    ['anna', 'bruno', 'carla', 'dario', 'elena'],
  );
  await passata(
    { titolo: 'Studio Analisi 2', categoria: 'studio', luogo: 'Aula B12', capacita: 3, organizzatore: 'anna', inizio: giorniFa(35) },
    ['bruno', 'carla', 'dario'],
  );
  await passata(
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'Campo CUS', capacita: 4, organizzatore: 'manuela', inizio: giorniFa(28) },
    ['anna', 'bruno', 'carla', 'dario', 'franco'],
  );
  await passata(
    { titolo: 'Cinema', categoria: 'svago', luogo: 'Cinema Arsenale', capacita: 5, organizzatore: 'giulia', inizio: giorniFa(21) },
    ['luca', 'franco', 'elena', 'dario'],
    // Il cinema ha un posto in meno. dario, l'ultimo entrato, torna in coda e resta fuori
    (id) => modificaAttivita(id, 'giulia', { capacita: 4 }, { forza: true, orologio }),
  );
  await passata(
    { titolo: 'Studio Fisica', categoria: 'studio', luogo: 'Polo Fibonacci', capacita: 3, organizzatore: 'bruno', inizio: giorniFa(14) },
    ['anna', 'carla', 'elena'],
    // Elena era in coda e rinuncia
    (id) => esci(id, 'elena', orologio),
  );
  await passata(
    { titolo: 'Passaggio per Livorno', categoria: 'trasporto', luogo: 'Stazione Pisa Centrale', capacita: 3, organizzatore: 'luca', inizio: giorniFa(7) },
    ['giulia', 'franco', 'dario'],
  );

  // Un'attività futura per politica
  const ordini = {} as Record<PoliticaCoda, Riga[]>;
  for (const politicaCoda of POLITICHE) {
    const id = await crea({
      titolo: `Calcetto (${politicaCoda})`,
      categoria: 'sport',
      luogo: 'Campo CUS',
      capacita: 3,
      organizzatore: 'manuela',
      inizio: oggi + 7 * GIORNO,
      politicaCoda,
    });
    tempo = oggi;
    await iscrivili(id, ['anna', 'bruno', ...IN_CODA]);

    const righe: Riga[] = [];
    for (const uid of IN_CODA) {
      const esito = await iscrivi(id, uid, orologio);
      if (esito.esito === 'in_attesa') righe.push({ posizione: esito.posizione, uid, motivo: esito.motivo });
    }
    ordini[politicaCoda] = righe.sort((a, b) => a.posizione - b.posizione);
  }
  return ordini;
}

import { COLLEZIONI, type Categoria, type PoliticaCoda, type Utente } from 'modello';
import { creaAttivita, validaNuovaAttivita } from './attivita.js';
import { db } from './firestore.js';
import { esci, iscrivi } from './iscrizioni.js';
import { modificaAttivita } from './modifiche.js';
import { consolidaAttivita } from './storico.js';

const MINUTO = 60 * 1000;
const GIORNO = 24 * 60 * MINUTO;

export const POLITICHE: PoliticaCoda[] = ['fifo', 'affinita', 'esplorazione', 'rotazione', 'equita'];
export const IN_CODA = ['rossini', 'verdi', 'morricone', 'einaudi', 'bellini', 'paganini'];

// Persone d'esempio che si iscrivono alle attività
export const PERSONE = {
  puccini: 'Giacomo Puccini',
  monteverdi: 'Claudio Monteverdi',
  vivaldi: 'Antonio Vivaldi',
  rossini: 'Gioachino Rossini',
  verdi: 'Giuseppe Verdi',
  morricone: 'Ennio Morricone',
  einaudi: 'Ludovico Einaudi',
  bellini: 'Vincenzo Bellini',
  paganini: 'Niccolo Paganini',
};
export type Personaggio = keyof typeof PERSONE;

export type Interpreti = Partial<Record<Personaggio, string>>;

async function scriviProfili(uidDi: (p: string) => string, oggi: number) {
  for (const [personaggio, nome] of Object.entries(PERSONE)) {
    const riferimento = db.collection(COLLEZIONI.utenti).doc(uidDi(personaggio));
    if ((await riferimento.get()).exists) continue;
    await riferimento.set({ nome, primoAccesso: oggi, ultimoAccesso: oggi } satisfies Utente);
  }
}

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
export async function popolaStorico(oggi: number, interpreti: Interpreti = {}): Promise<Record<PoliticaCoda, Riga[]>> {
  let tempo = oggi;
  const orologio = () => tempo;
  const giorniFa = (n: number) => oggi - n * GIORNO;
  const uidDi = (p: string) => interpreti[p as Personaggio] ?? p;

  await scriviProfili(uidDi, oggi);

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
    return creaAttivita(uidDi(s.organizzatore), esito.valore, tempo);
  }

  async function iscrivili(id: string, uid: string[]) {
    for (const u of uid) {
      tempo += MINUTO;
      await iscrivi(id, uidDi(u), orologio);
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

  // Monteverdi, vivaldi e rossini partecipano sempre insieme, verdi resta spesso fuori,
  // bellini, paganini e einaudi sono un altro giro, morricone rinuncia una volta
  await passata(
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'Campo CUS', capacita: 4, organizzatore: 'puccini', inizio: giorniFa(40) },
    ['monteverdi', 'vivaldi', 'rossini', 'verdi', 'morricone'],
  );
  await passata(
    { titolo: 'Studio Analisi 2', categoria: 'studio', luogo: 'Aula B12', capacita: 3, organizzatore: 'monteverdi', inizio: giorniFa(35) },
    ['vivaldi', 'rossini', 'verdi'],
  );
  await passata(
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'Campo CUS', capacita: 4, organizzatore: 'puccini', inizio: giorniFa(28) },
    ['monteverdi', 'vivaldi', 'rossini', 'verdi', 'einaudi'],
  );
  await passata(
    { titolo: 'Cinema', categoria: 'svago', luogo: 'Cinema Arsenale', capacita: 5, organizzatore: 'bellini', inizio: giorniFa(21) },
    ['paganini', 'einaudi', 'morricone', 'verdi'],
    // Il cinema ha un posto in meno. verdi, l'ultimo entrato, torna in coda e resta fuori
    (id) => modificaAttivita(id, uidDi('bellini'), { capacita: 4 }, { forza: true, orologio }),
  );
  await passata(
    { titolo: 'Studio Fisica', categoria: 'studio', luogo: 'Polo Fibonacci', capacita: 3, organizzatore: 'vivaldi', inizio: giorniFa(14) },
    ['monteverdi', 'rossini', 'morricone'],
    // Morricone era in coda e rinuncia
    (id) => esci(id, uidDi('morricone'), orologio),
  );
  await passata(
    { titolo: 'Passaggio per Livorno', categoria: 'trasporto', luogo: 'Stazione Pisa Centrale', capacita: 3, organizzatore: 'paganini', inizio: giorniFa(7) },
    ['bellini', 'einaudi', 'verdi'],
  );

  // Un'attività futura per politica
  const ordini = {} as Record<PoliticaCoda, Riga[]>;
  for (const politicaCoda of POLITICHE) {
    const id = await crea({
      titolo: `Calcetto (${politicaCoda})`,
      categoria: 'sport',
      luogo: 'Campo CUS',
      capacita: 3,
      organizzatore: 'puccini',
      inizio: oggi + 7 * GIORNO,
      politicaCoda,
    });
    tempo = oggi;
    await iscrivili(id, ['monteverdi', 'vivaldi', ...IN_CODA]);

    const righe: Riga[] = [];
    for (const uid of IN_CODA) {
      const esito = await iscrivi(id, uidDi(uid), orologio);
      if (esito.esito === 'in_attesa') righe.push({ posizione: esito.posizione, uid, motivo: esito.motivo });
    }
    ordini[politicaCoda] = righe.sort((a, b) => a.posizione - b.posizione);
  }
  return ordini;
}

import { COLLEZIONI, type Categoria, type Luogo, type PoliticaCoda, type Utente } from 'modello';
import { creaAttivita, validaNuovaAttivita } from './attivita.js';
import { db } from './firestore.js';
import { esci, iscrivi } from './iscrizioni.js';
import { annullaAttivita, modificaAttivita } from './modifiche.js';
import { consolidaAttivita } from './storico.js';

const MINUTO = 60 * 1000;
const GIORNO = 24 * 60 * MINUTO;

const POLITICHE: PoliticaCoda[] = ['fifo', 'affinita', 'esplorazione', 'rotazione', 'equita'];
const IN_CODA = ['rossini', 'verdi', 'morricone', 'einaudi', 'bellini', 'paganini'];

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

// Luoghi d'esempio dove si svolgono le attività
const LUOGHI = {
  cus: { testo: 'Campo CUS', nome: 'Via Federico Chiarugi, Pisa', lat: 43.7113, lon: 10.417 },
  b12: { testo: 'Aula B12', nome: 'Largo Lucio Lazzarino, Pisa', lat: 43.7209, lon: 10.3898 },
  fibonacci: { testo: 'Polo Fibonacci', nome: 'Largo Bruno Pontecorvo, Pisa', lat: 43.7205, lon: 10.4079 },
  arsenale: { testo: 'Cinema Arsenale', nome: 'Vicolo Scaramucci, Pisa', lat: 43.7178, lon: 10.401 },
  stazione: { testo: 'Stazione Pisa Centrale', nome: 'Piazza della Stazione, Pisa', lat: 43.7085, lon: 10.3983 },
  cavalieri: { testo: 'Piazza dei Cavalieri', nome: 'Piazza dei Cavalieri, Pisa', lat: 43.7196, lon: 10.4002 },
} satisfies Record<string, Luogo>;

export type Interpreti = Partial<Record<Personaggio, string>>;

async function scriviProfili(uidDi: (p: string) => string, oggi: number) {
  for (const [personaggio, nome] of Object.entries(PERSONE)) {
    const riferimento = db.collection(COLLEZIONI.utenti).doc(uidDi(personaggio));
    if ((await riferimento.get()).exists) continue;
    await riferimento.set({ nome, primoAccesso: oggi, ultimoAccesso: oggi } satisfies Utente);
  }
}

export async function togliScenario(interpreti: Interpreti = {}) {
  let tolte = 0;
  for (const personaggio of Object.keys(PERSONE) as Personaggio[]) {
    const uid = interpreti[personaggio] ?? personaggio;
    const sue = await db.collection(COLLEZIONI.attivita).where('organizzatore', '==', uid).get();
    for (const d of sue.docs) {
      // Con l'attività spariscono partecipanti e cronologia
      await db.recursiveDelete(d.ref);
      tolte += 1;
    }
    await db.collection(COLLEZIONI.statistiche).doc(uid).delete();
  }
  return tolte;
}

export interface Riga {
  posizione: number;
  uid: string;
  motivo: string;
}

interface Scheda {
  titolo: string;
  descrizione?: string;
  categoria: Categoria;
  luogo: keyof typeof LUOGHI;
  capacita: number;
  organizzatore: string;
  inizio: number;
  politicaCoda?: PoliticaCoda;
}

// Uno storico 
// programma: il giorno da cui cominciano le attività 
export async function popolaStorico(
  oggi: number,
  interpreti: Interpreti = {},
  programma = oggi + 7 * GIORNO,
): Promise<Record<PoliticaCoda, Riga[]>> {
  let tempo = oggi;
  const orologio = () => tempo;
  const giorniFa = (n: number) => oggi - n * GIORNO;
  // Un giorno del programma, a un'ora di orologio
  const fra = (giorni: number, ore: number, minuti = 0) =>
    new Date(programma + giorni * GIORNO).setHours(ore, minuti, 0, 0);
  const uidDi = (p: string) => interpreti[p as Personaggio] ?? p;

  await scriviProfili(uidDi, oggi);

  async function crea(s: Scheda) {
    tempo = Math.min(s.inizio - 2 * GIORNO, oggi);
    const dati = {
      titolo: s.titolo,
      descrizione: s.descrizione ?? '',
      categoria: s.categoria,
      inizio: s.inizio,
      durataMinuti: 90,
      luogo: LUOGHI[s.luogo],
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
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'cus', capacita: 4, organizzatore: 'puccini', inizio: giorniFa(40) },
    ['monteverdi', 'vivaldi', 'rossini', 'verdi', 'morricone'],
  );
  await passata(
    { titolo: 'Studio Analisi 2', categoria: 'studio', luogo: 'b12', capacita: 3, organizzatore: 'monteverdi', inizio: giorniFa(35) },
    ['vivaldi', 'rossini', 'verdi'],
  );
  await passata(
    { titolo: 'Calcetto', categoria: 'sport', luogo: 'cus', capacita: 4, organizzatore: 'puccini', inizio: giorniFa(28) },
    ['monteverdi', 'vivaldi', 'rossini', 'verdi', 'einaudi'],
  );
  await passata(
    { titolo: 'Cinema', categoria: 'svago', luogo: 'arsenale', capacita: 5, organizzatore: 'bellini', inizio: giorniFa(21) },
    ['paganini', 'einaudi', 'morricone', 'verdi'],
    // Il cinema ha un posto in meno. verdi, l'ultimo entrato, torna in coda e resta fuori
    (id) => modificaAttivita(id, uidDi('bellini'), { capacita: 4 }, { forza: true, orologio }),
  );
  await passata(
    { titolo: 'Studio Fisica', categoria: 'studio', luogo: 'fibonacci', capacita: 3, organizzatore: 'vivaldi', inizio: giorniFa(14) },
    ['monteverdi', 'rossini', 'morricone'],
    // Morricone era in coda e rinuncia
    (id) => esci(id, uidDi('morricone'), orologio),
  );
  await passata(
    { titolo: 'Gruppo studio Basi di dati', categoria: 'studio', luogo: 'fibonacci', capacita: 4, organizzatore: 'verdi', inizio: giorniFa(18) },
    ['paganini', 'bellini', 'morricone'],
  );
  await passata(
    { titolo: 'Torneo di scacchi', categoria: 'svago', luogo: 'cavalieri', capacita: 4, organizzatore: 'einaudi', inizio: giorniFa(10) },
    ['verdi', 'paganini', 'bellini'],
  );
  await passata(
    { titolo: 'Passaggio per Livorno', categoria: 'trasporto', luogo: 'stazione', capacita: 3, organizzatore: 'paganini', inizio: giorniFa(7) },
    ['bellini', 'einaudi', 'verdi'],
  );

  // Un'attività futura per politica
  const ordini = {} as Record<PoliticaCoda, Riga[]>;
  for (const [giorno, politicaCoda] of POLITICHE.entries()) {
    const id = await crea({
      titolo: `Calcetto (${politicaCoda})`,
      categoria: 'sport',
      luogo: 'cus',
      capacita: 3,
      organizzatore: 'puccini',
      inizio: fra(giorno, 21),
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

  // Un'attività futura per iscritti
  async function futura(s: Scheda, iscritti: string[]) {
    const id = await crea(s);
    tempo = oggi;
    await iscrivili(id, iscritti);
    return id;
  }

  // Posti liberi
  await futura(
    { titolo: 'Gruppo studio Analisi 2', descrizione: 'Esercizi sugli integrali, portate il libro.', categoria: 'studio', luogo: 'b12', capacita: 6, organizzatore: 'monteverdi', inizio: fra(1, 15) },
    ['vivaldi', 'rossini'],
  );
  // Verdi ha il posto
  await futura(
    { titolo: 'Cineforum', descrizione: 'Film e due chiacchiere dopo.', categoria: 'svago', luogo: 'arsenale', capacita: 5, organizzatore: 'bellini', inizio: fra(2, 20, 30) },
    ['paganini', 'verdi', 'einaudi'],
  );
  // L'attività di verdi: piena, con monteverdi fra gli iscritti e morricone in lista
  await futura(
    { titolo: 'Ripasso Basi di dati', descrizione: 'Ripasso prima dell’esame: SQL e normalizzazione.', categoria: 'studio', luogo: 'fibonacci', capacita: 4, organizzatore: 'verdi', inizio: fra(3, 16), politicaCoda: 'rotazione' },
    ['monteverdi', 'paganini', 'bellini', 'morricone'],
  );
  // Annullata, con verdi fra gli iscritti
  const annullata = await futura(
    { titolo: 'Passaggio per Livorno', descrizione: 'Parto dalla stazione, tre posti in macchina.', categoria: 'trasporto', luogo: 'stazione', capacita: 4, organizzatore: 'paganini', inizio: fra(4, 8) },
    ['bellini', 'verdi'],
  );
  tempo += MINUTO;
  await annullaAttivita(annullata, uidDi('paganini'), orologio);
  // In un luogo dove verdi è già stato, con persone che conosce
  await futura(
    { titolo: 'Scacchi in piazza', descrizione: 'Partite veloci, scacchiere portate da noi.', categoria: 'svago', luogo: 'cavalieri', capacita: 8, organizzatore: 'einaudi', inizio: fra(5, 17) },
    ['morricone', 'paganini'],
  );

  return ordini;
}

import '../ambiente.js';

import { createInterface } from 'node:readline/promises';

const GIORNO = 24 * 60 * 60 * 1000;

function fermati(messaggio: string): never {
  console.error(messaggio);
  process.exit(1);
}

// Uso: npm run scenario [-- AAAA-MM-GG]; senza data il programma parte da domani
const data = process.argv[2];
const domani = new Date();
domani.setHours(0, 0, 0, 0);
domani.setDate(domani.getDate() + 1);
const programma =
  data === undefined
    ? domani.getTime()
    : /^\d{4}-\d{2}-\d{2}$/.test(data)
      ? new Date(`${data}T00:00:00`).getTime()
      : NaN;

if (Number.isNaN(programma)) fermati('data non valida: npm run scenario -- AAAA-MM-GG');
if (programma < Date.now() || programma > Date.now() + 60 * GIORNO) {
  fermati('la data deve essere nel futuro, entro due mesi');
}

const emulatore = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const progetto = process.env.VITE_FIREBASE_PROJECT_ID ?? 'progetto';

if (!emulatore) {
  const porta = process.env.PORT ?? 3000;
  const accesa = await fetch(`http://localhost:${porta}/health`, { signal: AbortSignal.timeout(2000) }).then(
    (risposta) => risposta.ok,
    () => false,
  );
  if (accesa) fermati(`l'API è accesa sulla porta ${porta}: va fermata prima di caricare lo scenario`);
}

const { auth } = await import('../firebase.js');
const { db } = await import('../firestore.js');
const { PERSONE, popolaStorico, togliScenario } = await import('../scenario.js');

const indirizzi = (process.env.TEST_USER_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
if (indirizzi.length < 2) fermati('servono due indirizzi in TEST_USER_EMAIL: vedi il README');

const interpreti: Record<string, string> = {};
for (const personaggio of Object.keys(PERSONE)) interpreti[personaggio] = `prova-${personaggio}`;

console.log(`scenario su: ${emulatore ? 'emulatore' : `progetto vero (${progetto})`}`);
console.log(`  programma da ${new Date(programma).toLocaleDateString('it-IT', { dateStyle: 'full' })}`);

for (const [i, personaggio] of ['verdi', 'monteverdi'].entries()) {
  const indirizzo = indirizzi[i]!;
  const account = await auth.getUserByEmail(indirizzo).catch(() => null);
  if (!account) fermati(`l'account ${indirizzo} non esiste: lanciare prima npm run utente:test`);
  interpreti[personaggio] = account.uid;
  console.log(`  ${personaggio}: ${indirizzo}`);
}

if (!emulatore) {
  const tastiera = createInterface({ input: process.stdin, output: process.stdout });
  const risposta = await tastiera.question(
    `Le attività organizzate dai personaggi verranno tolte e ricreate.\nPer confermare scrivi ${progetto}: `,
  );
  tastiera.close();
  if (risposta.trim() !== progetto) fermati('non confermato: niente è stato scritto');
}

for (const personaggio of ['verdi', 'monteverdi']) {
  const account = await auth.getUser(interpreti[personaggio]!);
  const profilo = db.collection('utenti').doc(account.uid);
  if ((await profilo.get()).exists) continue;
  const adesso = Date.now();
  await profilo.set({ nome: account.displayName ?? 'Utente di prova', primoAccesso: adesso, ultimoAccesso: adesso });
}

const tolte = await togliScenario(interpreti);
console.log(`  attività dello scenario precedente tolte: ${tolte}`);

await popolaStorico(Date.now(), interpreti, programma);

const caricate = await db.collection('attivita').where('organizzatore', 'in', Object.values(interpreti)).count().get();
console.log(`  attività caricate: ${caricate.data().count}`);

await db.terminate();

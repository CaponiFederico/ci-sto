import { radiceMonorepo } from '../ambiente.js';

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';

function fermati(messaggio: string): never {
  console.error(messaggio);
  process.exit(1);
}

const emulatore = Boolean(process.env.FIRESTORE_EMULATOR_HOST);
const progetto = process.env.VITE_FIREBASE_PROJECT_ID ?? 'progetto';

if (!emulatore) {
  const porta = process.env.PORT ?? 3000;
  const accesa = await fetch(`http://localhost:${porta}/health`, { signal: AbortSignal.timeout(2000) }).then(
    (risposta) => risposta.ok,
    () => false,
  );
  if (accesa) fermati(`l'API è accesa sulla porta ${porta}: va fermata prima di svuotare`);
}

// inizializza firebase-admin
const { db } = await import('../firestore.js');

const attivita = await db.collection('attivita').orderBy('inizio').get();
const statistiche = await db.collection('statistiche').get();

console.log(`da svuotare su: ${emulatore ? 'emulatore' : `progetto vero (${progetto})`}`);
console.log(`  attività: ${attivita.size}`);
for (const d of attivita.docs) {
  const giorno = new Date(d.get('inizio')).toLocaleDateString('it-IT');
  console.log(`    ${giorno}  ${d.get('titolo')}  (${d.get('stato')})`);
}
console.log(`  storici di partecipazione: ${statistiche.size}`);
console.log('  restano: profili e dispositivi delle notifiche');

if (attivita.size + statistiche.size === 0) {
  console.log('niente da togliere');
  await db.terminate();
  process.exit(0);
}

if (!emulatore) {
  const tastiera = createInterface({ input: process.stdin, output: process.stdout });
  const risposta = await tastiera.question(`Non si può annullare. Per confermare scrivi ${progetto}: `);
  tastiera.close();
  if (risposta.trim() !== progetto) fermati('non confermato: niente è stato cancellato');
}

const copia = {
  quando: new Date().toISOString(),
  attivita: await Promise.all(
    attivita.docs.map(async (d) => ({
      id: d.id,
      dati: d.data(),
      partecipanti: (await d.ref.collection('partecipanti').get()).docs.map((p) => ({ id: p.id, ...p.data() })),
      eventi: (await d.ref.collection('eventi').get()).docs.map((e) => e.data()),
    })),
  ),
  statistiche: statistiche.docs.map((d) => ({ id: d.id, ...d.data() })),
};
const cartella = join(radiceMonorepo, 'copie');
mkdirSync(cartella, { recursive: true });
const file = join(cartella, `copia-${copia.quando.replace(/[:.]/g, '-')}.json`);
writeFileSync(file, JSON.stringify(copia, null, 2));
console.log(`  copia salvata in ${file}`);

for (const d of attivita.docs) await db.recursiveDelete(d.ref);
for (const d of statistiche.docs) await d.ref.delete();

console.log(`  tolte ${attivita.size} attività e ${statistiche.size} storici`);
await db.terminate();

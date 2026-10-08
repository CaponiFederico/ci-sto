import '../ambiente.js';

// emulatore
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('FIRESTORE_EMULATOR_HOST non impostata: lanciare con npm run popola');
  process.exit(1);
}

//  inizializzano firebase-admin
const { popolaStorico } = await import('../scenario.js');
const { db } = await import('../firestore.js');

const ordini = await popolaStorico(Date.now());

for (const [politica, righe] of Object.entries(ordini)) {
  console.log(`\n${politica}`);
  for (const { posizione, uid, motivo } of righe) console.log(`  ${posizione}. ${uid.padEnd(10)} ${motivo}`);
}

await db.terminate();

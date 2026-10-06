import '../ambiente.js';

// inizializzano firebase-admin
const { eseguiJob } = await import('../job.js');
const { db } = await import('../firestore.js');

const dove = process.env.FIRESTORE_EMULATOR_HOST ? 'emulatore' : 'progetto vero';
console.log(`job su: ${dove}`);

const esito = await eseguiJob();
console.log(`  attività consolidate: ${esito.consolidate}`);
console.log(`  posti liberati per riconferma scaduta: ${esito.scadute}`);
console.log(`  promemoria mandati: ${esito.promemoria}`);
console.log(`  avvisi di scadenza vicina: ${esito.preavvisi}`);

await db.terminate();

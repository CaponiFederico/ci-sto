import '../ambiente.js';

// inizializza firebase
const { consolidaCominciate } = await import('../storico.js');
const { db } = await import('../firestore.js');

const dove = process.env.FIRESTORE_EMULATOR_HOST ? 'emulatore' : 'progetto vero';
console.log(`consolidamento su: ${dove}`);

const fatte = await consolidaCominciate();

if (fatte.length === 0) console.log('nessuna attività da consolidare');
for (const { titolo, id, esito } of fatte) {
  const dettaglio =
    esito.esito === 'consolidata'
      ? `${esito.presenti.length} presenti, ${esito.esclusi.length} rimasti in lista`
      : esito.esito === 'rifiutato'
        ? esito.motivo
        : 'già consolidata';
  console.log(`  ${titolo} (${id}): ${dettaglio}`);
}

await db.terminate();

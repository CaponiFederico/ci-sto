const host = process.env.FIRESTORE_EMULATOR_HOST;

// Senza emulatore SDK scriverebbe sul database
if (!host) {
  throw new Error('FIRESTORE_EMULATOR_HOST non impostata: lanciare i test con npm test');
}

const progetto = process.env.GCLOUD_PROJECT ?? 'bacheca-unipi-fc';

export async function svuotaFirestore() {
  const risposta = await fetch(
    `http://${host}/emulator/v1/projects/${progetto}/databases/(default)/documents`,
    { method: 'DELETE' },
  );
  if (!risposta.ok) throw new Error(`svuotamento dell'emulatore fallito: ${risposta.status}`);
}

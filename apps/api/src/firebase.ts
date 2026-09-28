import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { radiceMonorepo } from './ambiente.js';

function credenziali() {
  const percorso = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!percorso) throw new Error('manca GOOGLE_APPLICATION_CREDENTIALS: vedi .env.example');
  return cert(JSON.parse(readFileSync(resolve(radiceMonorepo, percorso), 'utf8')));
}

// Con l'emulatore non serve la chiave privata: i test girano anche su un clone senza segreti.
export const app = process.env.FIRESTORE_EMULATOR_HOST
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'bacheca-unipi-fc' })
  : initializeApp({ credential: credenziali() });

export const auth = getAuth(app);

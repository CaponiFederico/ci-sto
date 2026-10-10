import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { chiaveDelServizio } from './credenziali.js';

// Con l'emulatore non serve la chiave privata
export const app = process.env.FIRESTORE_EMULATOR_HOST
  ? initializeApp({ projectId: process.env.GCLOUD_PROJECT ?? 'bacheca-unipi-fc' })
  : initializeApp({ credential: cert(chiaveDelServizio()) });

export const auth = getAuth(app);

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cert, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { radiceMonorepo } from './ambiente.js';

const percorso = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!percorso) {
  throw new Error('manca GOOGLE_APPLICATION_CREDENTIALS: vedi .env.example');
}

const credenziali = JSON.parse(readFileSync(resolve(radiceMonorepo, percorso), 'utf8'));

export const app = initializeApp({ credential: cert(credenziali) });
export const auth = getAuth(app);

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ServiceAccount } from 'firebase-admin/app';
import { radiceMonorepo } from './ambiente.js';

const CAMPI = ['project_id', 'client_email', 'private_key'];

function interpreta(testo: string, origine: string): ServiceAccount {
  let chiave: Record<string, unknown>;
  try {
    chiave = JSON.parse(testo);
  } catch {
    throw new Error(`${origine} non contiene un JSON valido: vedi il README`);
  }
  const mancanti = CAMPI.filter((campo) => typeof chiave?.[campo] !== 'string');
  if (mancanti.length > 0) throw new Error(`${origine}: nella chiave manca ${mancanti.join(', ')}`);
  return chiave as ServiceAccount;
}

// La chiave scritta nel .env vince sul file
export function chiaveDelServizio(): ServiceAccount {
  const scritta = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
  if (scritta) return interpreta(scritta, 'FIREBASE_SERVICE_ACCOUNT');

  const percorso = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!percorso) {
    throw new Error('manca FIREBASE_SERVICE_ACCOUNT o GOOGLE_APPLICATION_CREDENTIALS: vedi il README');
  }

  let testo: string;
  try {
    testo = readFileSync(resolve(radiceMonorepo, percorso), 'utf8');
  } catch {
    throw new Error(`non trovo il file ${percorso} indicato da GOOGLE_APPLICATION_CREDENTIALS`);
  }
  return interpreta(testo, percorso);
}

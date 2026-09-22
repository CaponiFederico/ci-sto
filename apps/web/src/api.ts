import { auth } from './firebase';

const base = import.meta.env.VITE_API_BASE_URL;

export class ErroreApi extends Error {
  readonly stato: number;
  readonly codice: string;

  constructor(stato: number, codice: string) {
    super(`${stato} ${codice}`);
    this.stato = stato;
    this.codice = codice;
  }
}

export async function chiamaApi<T>(percorso: string, opzioni: RequestInit = {}): Promise<T> {
  const utente = auth.currentUser;
  if (!utente) throw new ErroreApi(401, 'non_autenticato');

  const intestazioni = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${await utente.getIdToken()}`,
    ...opzioni.headers,
  };

  // fetch solleva solo se la rete fallisce: un 4xx è una risposta, e va distinto.
  let risposta: Response;
  try {
    risposta = await fetch(`${base}${percorso}`, { ...opzioni, headers: intestazioni });
  } catch {
    throw new ErroreApi(0, 'api_irraggiungibile');
  }

  const corpo = await risposta.json().catch(() => ({}) as Record<string, unknown>);
  if (!risposta.ok) {
    throw new ErroreApi(risposta.status, String(corpo.error ?? 'errore_sconosciuto'));
  }
  return corpo as T;
}

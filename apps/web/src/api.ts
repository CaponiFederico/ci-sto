import { auth } from './firebase';

const base = import.meta.env.VITE_API_BASE_URL;

export class ErroreApi extends Error {
  readonly stato: number;
  readonly codice: string;
  // I campi rifiutati
  readonly campi: string[];

  constructor(stato: number, codice: string, campi: string[] = []) {
    super(`${stato} ${codice}`);
    this.stato = stato;
    this.codice = codice;
    this.campi = campi;
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

  // fetch solleva solo se la rete fallisce
  let risposta: Response;
  try {
    risposta = await fetch(`${base}${percorso}`, { ...opzioni, headers: intestazioni });
  } catch {
    throw new ErroreApi(0, 'api_irraggiungibile');
  }

  const corpo = await risposta.json().catch(() => ({}) as Record<string, unknown>);
  if (!risposta.ok) {
    const campi = Array.isArray(corpo.campi) ? corpo.campi.map(String) : [];
    throw new ErroreApi(risposta.status, String(corpo.error ?? 'errore_sconosciuto'), campi);
  }
  return corpo as T;
}

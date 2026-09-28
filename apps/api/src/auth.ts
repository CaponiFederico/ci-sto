import type { NextFunction, Request, Response } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { auth } from './firebase.js';

function insieme(valore: string | undefined) {
  return new Set(
    (valore ?? '')
      .split(',')
      .map((v) => v.trim().toLowerCase())
      .filter(Boolean),
  );
}

const dominiAmmessi = insieme(process.env.ALLOWED_EMAIL_DOMAINS);
const indirizziAmmessi = insieme(process.env.ALLOWED_EMAILS);

export function appartieneAllAteneo(email: string | undefined) {
  if (!email) return false;
  const indirizzo = email.toLowerCase();
  const dominio = indirizzo.slice(indirizzo.lastIndexOf('@') + 1);
  return indirizziAmmessi.has(indirizzo) || dominiAmmessi.has(dominio);
}

export interface RichiestaAutenticata extends Request {
  token: DecodedIdToken;
}

export async function richiediAutenticazione(req: Request, res: Response, next: NextFunction) {
  const intestazione = req.header('authorization') ?? '';
  if (!intestazione.startsWith('Bearer ')) {
    res.status(401).json({ error: 'token_mancante' });
    return;
  }

  try {
    (req as RichiestaAutenticata).token = await auth.verifyIdToken(intestazione.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'token_non_valido' });
  }
}

// Autenticato non basta: senza il claim l'utente è fuori dalle liste dei domini.
export function richiediAteneo(req: Request, res: Response, next: NextFunction) {
  if ((req as RichiestaAutenticata).token.ateneo !== true) {
    res.status(403).json({ error: 'non_ammesso' });
    return;
  }
  next();
}

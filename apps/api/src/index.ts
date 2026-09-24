import './ambiente.js';

import cors from 'cors';
import express from 'express';
import {
  appartieneAllAteneo,
  richiediAutenticazione,
  type RichiestaAutenticata,
} from './auth.js';
import { auth } from './firebase.js';
import { db } from './firestore.js';
import { COLLEZIONI, type Utente } from 'modello';

const app = express();

// Senza, req.body è undefined.
app.use(express.json());

// Il frontend sta su un'origine diversa dall'API, in sviluppo e in produzione.
const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

// la lista dei domini resta solo qui.
app.post('/v1/session', richiediAutenticazione, async (req, res) => {
  const { uid, email, email_verified, name, ateneo } = (req as RichiestaAutenticata).token;

  if (!email_verified) {
    res.status(403).json({ error: 'email_non_verificata' });
    return;
  }

  if (!appartieneAllAteneo(email)) {
    res.status(403).json({ error: 'dominio_non_ammesso', email });
    return;
  }

  const daConcedere = ateneo !== true;
  if (daConcedere) {
    await auth.setCustomUserClaims(uid, { ateneo: true });
  }

  const adesso = Date.now();
  const profilo: Partial<Utente> = { email: email!, ultimoAccesso: adesso };
  if (name) profilo.nome = name as string;

  const riferimento = db.collection(COLLEZIONI.utenti).doc(uid);

  // Con merge un campo presente verrebbe riscritto a ogni accesso.
  if (!(await riferimento.get()).exists) profilo.primoAccesso = adesso;

  await riferimento.set(profilo, { merge: true });

  res.json({ ateneo: true, email, aggiornaToken: daConcedere });
});

// Gestore d'errore: con meno di quattro parametri Express non lo invoca mai.
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: 'internal_error' });
  },
);

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  console.log(`api in ascolto su http://localhost:${port}`);
  console.log(`origini CORS ammesse: ${origins.join(', ')}`);
});

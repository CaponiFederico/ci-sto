import './ambiente.js';

import cors from 'cors';
import express from 'express';
import { creaAttivita, validaModifica, validaNuovaAttivita } from './attivita.js';
import { esci, iscrivi, statoIscrizione } from './iscrizioni.js';
import { cercaLuoghi } from './luoghi.js';
import { annullaAttivita, modificaAttivita } from './modifiche.js';
import { riconferma } from './riconferme.js';
import {
  appartieneAllAteneo,
  richiediAteneo,
  richiediAutenticazione,
  type RichiestaAutenticata,
} from './auth.js';
import { auth } from './firebase.js';
import { db } from './firestore.js';
import { COLLEZIONI, RICERCA_LUOGO, type Utente } from 'modello';

export const app = express();

// Senza, req.body è undefined
app.use(express.json());

// Il frontend sta su un'origine diversa dall'API
export const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({ origin: origins }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, at: new Date().toISOString() });
});

// la lista dei domini 
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

  // Con merge un campo presente verrebbe riscritto a ogni accesso
  if (!(await riferimento.get()).exists) profilo.primoAccesso = adesso;

  await riferimento.set(profilo, { merge: true });

  res.json({ ateneo: true, email, aggiornaToken: daConcedere });
});

app.post('/v1/attivita', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const esito = validaNuovaAttivita(req.body);
  if (!esito.ok) {
    res.status(400).json({ error: 'dati_non_validi', campi: esito.errori });
    return;
  }

  const id = await creaAttivita((req as RichiestaAutenticata).token.uid, esito.valore);
  res.status(201).json({ id });
});

// PATCH: si mandano solo i campi da cambiare
app.patch('/v1/attivita/:id', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const esito = validaModifica(req.body);
  if (!esito.ok) {
    res.status(400).json({ error: 'dati_non_validi', campi: esito.errori });
    return;
  }

  const uid = (req as RichiestaAutenticata).token.uid;
  const forza = req.body.forza === true;
  res.json(await modificaAttivita(req.params.id as string, uid, esito.valore, { forza }));
});

// L'esito è la risposta
app.post('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const vista: unknown = req.body?.versioneVista;
  const versioneVista = Number.isInteger(vista) ? (vista as number) : undefined;

  const uid = (req as RichiestaAutenticata).token.uid;
  res.json(await iscrivi(req.params.id as string, uid, Date.now, versioneVista));
});

app.get('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  res.json(await statoIscrizione(req.params.id as string, (req as RichiestaAutenticata).token.uid));
});

app.delete('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  res.json(await esci(req.params.id as string, (req as RichiestaAutenticata).token.uid));
});

app.post('/v1/attivita/:id/riconferma', richiediAutenticazione, richiediAteneo, async (req, res) => {
  res.json(await riconferma(req.params.id as string, (req as RichiestaAutenticata).token.uid));
});

app.post('/v1/attivita/:id/annullamento', richiediAutenticazione, richiediAteneo, async (req, res) => {
  res.json(await annullaAttivita(req.params.id as string, (req as RichiestaAutenticata).token.uid));
});

// no autenticazione ma solo a chi appartiene all'ateneo
app.get('/v1/luoghi', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < RICERCA_LUOGO.minima || q.length > RICERCA_LUOGO.massima) {
    res.status(400).json({ error: 'ricerca_non_valida' });
    return;
  }

  res.json(await cercaLuoghi(q));
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

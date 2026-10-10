import './ambiente.js';

import cors from 'cors';
import express from 'express';
import { creaAttivita, validaModifica, validaNuovaAttivita } from './attivita.js';
import { mandaAvvisi, type Avviso } from './avvisi.js';
import { esci, iscrivi, statoIscrizione } from './iscrizioni.js';
import { cercaLuoghi, indirizzoDi } from './luoghi.js';
import { invia } from './push.js';
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
  const riferimento = db.collection(COLLEZIONI.utenti).doc(uid);
  const esistente = (await riferimento.get()).data() as Partial<Utente> | undefined;

  const profilo: Partial<Utente> = { ultimoAccesso: adesso };
  if (name) profilo.nome = name as string;
  else if (!esistente?.nome) profilo.nome = email!.split('@')[0];

  // Con merge un campo presente verrebbe riscritto a ogni accesso
  if (!esistente) profilo.primoAccesso = adesso;

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
  const avvisi: Avviso[] = [];
  const avvisa = (a: Avviso[]) => void avvisi.push(...a);
  res.json(await modificaAttivita(req.params.id as string, uid, esito.valore, { forza, avvisa }));
  void mandaAvvisi(avvisi);
});

// L'esito è la risposta
app.post('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const vista: unknown = req.body?.versioneVista;
  const versioneVista = Number.isInteger(vista) ? (vista as number) : undefined;

  const uid = (req as RichiestaAutenticata).token.uid;
  const avvisi: Avviso[] = [];
  res.json(await iscrivi(req.params.id as string, uid, Date.now, versioneVista, (a) => avvisi.push(...a)));
  void mandaAvvisi(avvisi);
});

app.get('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  res.json(await statoIscrizione(req.params.id as string, (req as RichiestaAutenticata).token.uid));
});

app.delete('/v1/attivita/:id/iscrizione', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const avvisi: Avviso[] = [];
  const uid = (req as RichiestaAutenticata).token.uid;
  res.json(await esci(req.params.id as string, uid, Date.now, (a) => avvisi.push(...a)));
  void mandaAvvisi(avvisi);
});

app.post('/v1/attivita/:id/riconferma', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const avvisi: Avviso[] = [];
  const uid = (req as RichiestaAutenticata).token.uid;
  res.json(await riconferma(req.params.id as string, uid, (a) => avvisi.push(...a)));
  void mandaAvvisi(avvisi);
});

app.post('/v1/attivita/:id/annullamento', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const avvisi: Avviso[] = [];
  const uid = (req as RichiestaAutenticata).token.uid;
  res.json(await annullaAttivita(req.params.id as string, uid, Date.now, (a) => avvisi.push(...a)));
  void mandaAvvisi(avvisi);
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

// Da una posizione all'indirizzo
app.get('/v1/luoghi/inverso', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const lat = typeof req.query.lat === 'string' && req.query.lat !== '' ? Number(req.query.lat) : NaN;
  const lon = typeof req.query.lon === 'string' && req.query.lon !== '' ? Number(req.query.lon) : NaN;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
    res.status(400).json({ error: 'posizione_non_valida' });
    return;
  }

  res.json(await indirizzoDi(lat, lon));
});

// Una notifica di prova 
app.post('/v1/notifiche/prova', richiediAutenticazione, richiediAteneo, async (req, res) => {
  const uid = (req as RichiestaAutenticata).token.uid;
  res.json(
    await invia(uid, {
      titolo: 'Bacheca',
      testo: 'Le notifiche funzionano su questo dispositivo.',
      indirizzo: '/#/',
      etichetta: 'prova',
    }),
  );
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

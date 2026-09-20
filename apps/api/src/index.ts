import cors from 'cors';
import 'dotenv/config';
import express from 'express';

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

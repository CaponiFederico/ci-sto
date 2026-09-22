# Bacheca universitaria

Bacheca di ateneo per attività fra studenti: uno pubblica («calcetto 21:30, cerco
8 persone», «gruppo studio Analisi 2 giovedì»), gli altri si iscrivono. A posti
finiti si entra in lista d'attesa. Chi pubblica riceve una notifica quando
qualcuno entra; chi si iscrive riceve il promemoria prima dell'inizio.

Progetto per **Sviluppo Applicazioni Web (SAW) 2026**, Università di Pisa.

Nucleo:

- l'organizzatore può modificare data, ora, luogo e posti anche con iscritti
  presenti, e il sistema ne gestisce le conseguenze su iscritti, lista d'attesa
  e notifiche;
- la lista d'attesa non è una semplice FIFO: esistono più politiche di assegnazione,
  basate sullo storico delle interazioni fra utenti;
- l'elenco delle attività ha un ordinamento personalizzato, che tiene conto
  dello storico dell'utente rispetto a luoghi, categorie e altri partecipanti.

---

## Requisiti

- **Node.js ≥ 20** (sviluppato su 24.21.0 LTS)
- **Firebase CLI** per emulatori e deploy, invocabile con `npx firebase-tools`

## Avvio

```bash
git clone <url-del-repository>
cd ci-sto
npm install
cp .env.example .env
```

Le variabili sono documentate in [`.env.example`](.env.example).
Il file `.env` non è versionato: contiene valori legati alla propria
installazione.

Poi, in due terminali:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Il frontend risponde su `http://localhost:5173`, l'API su `http://localhost:3000`
(`GET /health` per verificare che sia viva).

## Build

```bash
npm run build
npm run preview
```

## Deploy

Il progetto Firebase è indicato in `.firebaserc`.
Serve autenticarsi:

```bash
npx firebase-tools login
npm run build
npx firebase-tools deploy --only hosting
```

---

## Struttura

```text
apps/
  web/                   Vite + React + TypeScript
    src/sw.ts            service worker: precaching, fallback offline
    src/pwa.ts           registrazione del service worker
    public/offline.html  pagina di fallback offline
  api/                   Express: REST, proxy verso i servizi esterni
firebase.json            hosting, regole Firestore, emulatori
firestore.rules          SEGNAPOSTO: nega tutto finché non ci sono le regole vere
firestore.indexes.json   indici composti, vuoto finché non servono
```

## Credenziali di prova

> Da compilare

## Licenza e attribuzioni

I dati dei luoghi provengono da [OpenStreetMap](https://www.openstreetmap.org/copyright)
tramite Nominatim — © OpenStreetMap contributors, ODbL.

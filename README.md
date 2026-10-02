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
- **Java** per l'emulatore Firestore (la Firebase CLI arriva con `npm install`)

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

## Emulatori

Autenticazione e Firestore in locale, senza toccare i dati veri. Richiede Java.

```bash
npm run emulatori
```

Interfaccia su `http://127.0.0.1:4000`, Authentication su 9099, Firestore su 8080.

## Test

Security Rules, iscrizioni, modifiche delle attività, politiche della lista d'attesa e rotte
dell'API sono verificate sugli emulatori.

```bash
npm test
```

Il comando avvia gli emulatori di Auth e Firestore, esegue i test e li spegne. I test delle
operazioni simultanee girano 3 volte ciascuno; per la verifica completa, 20 giri (circa un quarto
d'ora):

```bash
npm run test:concorrenza
```

## Storico di prova

Le politiche della lista d'attesa leggono lo storico delle partecipazioni.
Questo comando avvia l'emulatore Firestore e costruisce uno storico

```bash
npm run popola
```

## Deploy

Il progetto Firebase è indicato in `.firebaserc`. La prima volta serve autenticarsi:

```bash
npx firebase login
npm run deploy
```

Dopo che i test passano:

```bash
npm run deploy:regole
```

---

## Struttura

```text
apps/
  web/                    Vite + React + TypeScript
    src/App.tsx           accesso e scelta della pagina
    src/percorso.ts       navigazione: l'indirizzo dopo # decide la pagina
    src/pagine/           elenco, nuova attività, dettaglio, modifica
    src/componenti/       scheda, campi del modulo, iscrizione, conferma, nome
    src/dati.ts           letture da Firestore in tempo reale
    src/azioni.ts         scritture, sempre tramite l'API
    src/testi.ts          messaggi per ogni stato ed esito
    src/sw.ts             service worker: precaching, fallback offline
    public/offline.html   pagina di fallback offline
  api/                    Express
    src/app.ts            rotte
    src/iscrizioni.ts     iscrizione e uscita, in transazione
    src/modifiche.ts      modifica e annullamento di un'attività con iscritti
    src/riconferme.ts     riconferma dopo una modifica maggiore, scadenze
    src/coda.ts           ordine della lista d'attesa
    src/politiche.ts      le cinque politiche della lista d'attesa
    src/storico.ts        storico delle partecipazioni
packages/
  modello/                tipi, costanti e regole condivise da web e api
firebase.json             hosting, regole Firestore, emulatori
firestore.rules           regole di sicurezza: i client leggono, solo l'API scrive
firestore.indexes.json    indici composti, vuoto finché non servono
```

## Come funziona

Il browser legge da Firestore in tempo reale. Se qualcuno si iscrive, i posti cambiano.
Ogni scrittura passa dall'API, che decide in una transazione chi
ha il posto e chi va in lista d'attesa.

| Indirizzo | Pagina |
|---|---|
| `/#/` | elenco delle attività in programma, con filtri |
| `/#/nuova` | pubblicazione di un'attività |
| `/#/attivita/<id>` | dettaglio: iscrizione, uscita, posizione in lista d'attesa, riconferma |
| `/#/attivita/<id>/modifica` | modifica e annullamento, solo per chi organizza |

## Account di prova

Per provare la lista d'attesa servono più persone. Gli indirizzi in `TEST_USER_EMAIL` (separati da
virgola, elencati anche in `ALLOWED_EMAILS`) diventano account con la password `TEST_USER_PASSWORD`:

```bash
npm run utente:test
```

Si entra con «Accedi con email e password», una finestra del browser per account.

## Credenziali di prova

> Da compilare

## Licenza e attribuzioni

I dati dei luoghi provengono da [OpenStreetMap](https://www.openstreetmap.org/copyright)
tramite Nominatim — © OpenStreetMap contributors, ODbL.

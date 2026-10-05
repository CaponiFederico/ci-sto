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

Sul progetto finale lo storico si aggiorna quando un'attività comincia: chi ha il posto risulta
presente, chi è rimasto in lista risulta escluso. Questo comando lo fa per tutte le attività già
cominciate e non ancora contate.

ripeterlo non conta due volte.

```bash
npm run consolida
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
    src/componenti/       scheda, campi del modulo, luogo e ricerca, mappa, posizione, iscrizione, conferma, nome
    src/dati.ts           letture da Firestore in tempo reale
    src/azioni.ts         scritture, sempre tramite l'API
    src/sospese.ts        richieste in sospeso, salvate su IndexedDB
    src/invio.ts          invio delle richieste in sospeso al ritorno della rete
    src/rete.ts           stato della connessione
    src/posizione.ts      posizione di chi guarda: dal dispositivo o da un indirizzo scelto
    src/filtri.ts         filtri dell'elenco
    src/ordine.ts         ordine personale: pesi, punteggio, motivo
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
    src/luoghi.ts         ricerca degli indirizzi su Nominatim: cache e limite di richieste
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
| `/#/` | elenco delle attività in programma, con filtri e ordine personale |
| `/#/nuova` | pubblicazione di un'attività |
| `/#/attivita/<id>` | dettaglio: iscrizione, uscita, posizione in lista d'attesa, riconferma |
| `/#/attivita/<id>/modifica` | modifica e annullamento, solo per chi organizza |

## Ordine personale

Con «Ordina: Per te» ogni persona vede la bacheca con un ordionamento personale.

Il punteggio di un'attività è una somma di cinque segnali moltiplicati per un peso:

| Segnale | Descrizone | Peso |
|---|---|---|
| persone | quante persone con cui si è già partecipato hanno il posto (fino a 3) | 3 |
| categoria | quante volte si è partecipato ad attività di quella categoria (fino a 5) | 2 |
| luogo | quante volte si è stati in quel luogo (fino a 5) | 1 |
| vicinanza | quanto è vicina a chi guarda: 1 sul posto, 0 da 5 km in poi; conta solo se si è impostata la propria posizione | 2 |
| imminenza | quanto è vicina: 1 se comincia adesso, 0 da 14 giorni in poi | 4 |

Il calcolo avviene nel browser, sui documenti già scaricati.
Pesi e soglie stanno in `apps/web/src/ordine.ts`.


## Luogo, indirizzo e distanza

Un'attività ha un luogo, il nome con cui lo conosce chi ci va («Aula A1», «Campi da calcetto
CUS»), e un indirizzo. L'indirizzo si cerca dal modulo e si sceglie fra i risultati;
il civico si può aggiungere a mano.

La ricerca usa [Nominatim](https://nominatim.org/), il servizio di OpenStreetMap, in due modi:
da un testo a un elenco di indirizzi, e dalla posizione di chi pubblica al suo indirizzo. Il browser
non lo chiama mai direttamente: passa da `GET /v1/luoghi` e `GET /v1/luoghi/inverso`.

Le regole del servizio sono riportate in operations.osmfoundation.org/policies/nominatim

| Regola del servizio | Come è rispettata |
|---|---|
| al massimo una richiesta al secondo, per tutta l'applicazione | una coda nell'API: ogni richiesta parte dopo la precedente |
| non ripetere la stessa richiesta | i risultati restano in memoria nell'API |
| niente completamento automatico | la ricerca parte da un bottone, mai mentre si scrive |
| identificarsi | ogni richiesta porta il nome dell'applicazione e l'indirizzo di questo repository |
| attribuzione | «Risultati © OpenStreetMap» sotto l'elenco |

Si cerca una volta sola, quando si pubblica o si cambia il luogo: nome e coordinate vengono salvati
con l'attività, quindi leggere la bacheca non chiama nessun servizio esterno e funziona senza rete.

Nel dettaglio compaiono l'indirizzo, il collegamento «Apri nelle mappe» e un riquadro con la mappa
di openstreetmap.org. Il riquadro è la pagina di un altro sito: si vede solo con la rete, e la
posizione che mostra è indicativa.

La distanza si calcola nel browser, in linea d'aria, fra l'indirizzo dell'attività e la
posizione di chi guarda. Quest'ultima si imposta da «La mia posizione»: è quella del dispositivo,
chiesta solo quando serve, oppure un indirizzo scelto a mano.

Cambiare il luogo di un'attività con iscritti è una modifica che chiede loro di riconfermare;
aggiungere l'indirizzo senza cambiare il nome, no.

## Senza rete

Chi ha già aperto l'app su un dispositivo continua a usarla anche senza connessione.

| | Senza rete |
|---|---|
| sessione | resta aperta; un avviso in alto dice che si è offline |
| elenco e dettaglio | si vede l'ultima copia scaricata, indicata come «dati salvati» |
| attività a cui si partecipa | luogo, orario, partecipanti e cronologia sono scaricati in anticipo |
| iscrizione, uscita, riconferma | la richiesta resta "in sospeso" sul dispositivo e parte da sola al ritorno della rete |
| pubblicazione, modifica, annullamento | serve la rete |

Una richiesta in sospeso non è un posto garantito. Chi effettivamente ha il posto lo decide l'API quando la richiesta
arriva, nell'ordine in cui arrivano. Se nel frattempo l'attività è stata spostata, la richiesta non
viene accettata automaticamente ma l'app mostra che cosa è cambiato e chiede se iscriversi lo stesso.

Uscendo dall'account le richieste in sospeso vengono scartate, dopo una conferma.

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

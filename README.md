# Bacheca universitaria

Bacheca di ateneo per attività fra studenti: uno pubblica, gli altri si iscrivono. A posti finiti si entra in lista
d'attesa. Chi pubblica riceve una notifica quando qualcuno entra, chi si iscrive riceve il promemoria
prima dell'inizio.

| | Come |
|---|---|
| Frontend | Vite + React + TypeScript, in `apps/web` |
| Autenticazione | Firebase Auth: Google con account universitario, oppure email e password per gli account di prova |
| API | Express (`apps/api`) per tutte le scritture; Firestore per le letture in tempo reale; Nominatim per gli indirizzi |
| PWA | installabile, usabile senza rete con le iscrizioni in sospeso, notifiche Web Push |
| Modifica con iscritti | data, ora, luogo e posti si cambiano anche con iscritti, con le conseguenze su posti, lista d'attesa e notifiche |
| Lista d'attesa | cinque regole di ordinamento, basate sullo storico delle partecipazioni |
| Ordine personale | l'elenco si ordina sullo storico di chi guarda: persone, categorie, luoghi, distanza, data |

## Avvio

Serve Node.js ≥ 20 (sviluppato su 24.21.0)

```bash
git clone https://github.com/CaponiFederico/ci-sto.git
cd ci-sto
npm install
```

Il file `.env` allegato va copiato nella radice. Contiene:

| Variabile | A cosa serve |
|---|---|
| `PORT`, `CORS_ORIGINS` | porta dell'API e origini da cui il browser può chiamarla |
| `FIREBASE_SERVICE_ACCOUNT` | chiave del service account su una riga (in alternativa `GOOGLE_APPLICATION_CREDENTIALS` con il percorso del file) |
| `ALLOWED_EMAIL_DOMAINS`, `ALLOWED_EMAILS` | domini ammessi e indirizzi ammessi fuori da quei domini |
| `TEST_USER_EMAIL`, `TEST_USER_PASSWORD` | account creati da `npm run utente:test` |
| `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY` | chiavi delle notifiche (`npx web-push generate-vapid-keys`) |
| `VITE_API_BASE_URL`, `VITE_FIREBASE_*` | indirizzo dell'API e configurazione pubblica di Firebase |

Le `VITE_*` finiscono nel codice del frontend e sono pubbliche; le altre restano nell'API.

La prima volta, con l'API spenta, si carica la bacheca d'esempio: attività passate e in programma da
domani, con gli account di prova fra i partecipanti. `svuota` è facoltativo e toglie tutto prima;
entrambi chiedono di scrivere il nome del progetto, `bacheca-unipi-fc`.

```bash
npm run svuota
```

```bash
npm run scenario
```

Poi, in due terminali:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Frontend su `http://localhost:5173`, API su `http://localhost:3000`. L'API esegue anche le
operazioni a tempo (promemoria, scadenze, storico) all'avvio e ogni 5 minuti.

## Credenziali di prova

«Accedi con email e password», stessa password per i tre account: `prova-saw-2026`

| Account | Chi è |
|---|---|
| `utente.test@bacheca.invalid` | spesso in lista d'attesa; organizza «Ripasso Basi di dati» |
| `utente.test2@bacheca.invalid` | partecipa sempre con lo stesso gruppo; iscritto a «Ripasso Basi di dati» |
| `utente.test3@bacheca.invalid` | nessuno storico; ricaricare lo scenario non lo tocca, adatto alle prove libere |

Gli altri nomi nelle attività sono persone d'esempio, senza account.

### Cosa guardare

| Per vedere | Fare | Si vede |
|---|---|---|
| l'ordine personale | passare da «Per data» a «Per te», con ciascuno dei tre account | ordini diversi, ogni scheda dice perché; senza storico conta quasi solo la data |
| la lista d'attesa | come `utente.test`, aprire i cinque «Calcetto (…)» | la stessa lista in cinque ordini, con il motivo della propria posizione |
| la modifica con iscritti | come `utente.test`, in «Ripasso Basi di dati», portare i posti da 4 a 3 | l'ultimo iscritto va in testa alla lista d'attesa |
| la riconferma | spostare la stessa attività di più di mezz'ora, poi entrare come `utente.test2` | chi aveva il posto deve riconfermare entro una scadenza |
| l'uso senza rete | togliere la rete, ricaricare, iscriversi a un'attività | elenco leggibile; l'iscrizione resta in sospeso e parte al ritorno della rete |
| le notifiche | come `utente.test`, «Profilo» › «Attiva le notifiche»; da un altro browser, come `utente.test3`, iscriversi a «Ripasso Basi di dati» | la notifica arriva anche a scheda chiusa |

Su Brave le notifiche richiedono «Usa i servizi Google per la messaggistica push» in
`brave://settings/privacy`.

## Come funziona

Il browser legge da Firestore in tempo reale; ogni scrittura passa dall'API, che decide in una
transazione chi ha il posto e chi va in lista d'attesa. Entra chi ha un indirizzo verificato in
`ALLOWED_EMAIL_DOMAINS` o elencato in `ALLOWED_EMAILS`: l'API lo controlla al primo accesso e segna
l'account come ammesso, le regole di Firestore guardano solo quel segno.

**Modifica con iscritti.** Posti in più: entra il primo della lista. Posti in meno: gli ultimi
iscritti vanno in testa alla lista, dopo una conferma. Orario spostato di più di 30 minuti o luogo
cambiato: chi ha il posto riconferma entro 24 ore (o entro l'inizio), altrimenti lo perde.
Spostamenti minori: solo un avviso. Un'attività annullata resta visibile. Ogni cambiamento compare
nella cronologia dell'attività.

**Lista d'attesa.** La regola la sceglie chi pubblica e non cambia finché c'è qualcuno in lista. A
parità passa chi è arrivato prima.

| Regola | Passa per primo |
|---|---|
| Ordine d'arrivo | chi si è messo in lista prima |
| Affinità | chi ha già partecipato più volte con chi ha il posto |
| Esplorazione | chi conosce meno il gruppo |
| Rotazione | chi non partecipa da più tempo |
| Equità | chi è rimasto escluso più volte |

Lo storico su cui si basano si aggiorna quando un'attività comincia: chi ha il posto risulta
presente, chi è rimasto in lista escluso.

**Ordine personale.** Con «Per te» il punteggio è una somma pesata di cinque segnali, calcolata nel
browser sui documenti già scaricati (pesi in `apps/web/src/ordine.ts`):

| Segnale | Misura | Peso |
|---|---|---|
| persone | persone già incontrate che hanno il posto (fino a 3) | 3 |
| categoria | partecipazioni in quella categoria (fino a 5) | 2 |
| luogo | volte in quel luogo (fino a 5) | 1 |
| vicinanza | 1 sul posto, 0 da 5 km; solo con la propria posizione impostata nel «Profilo» | 2 |
| imminenza | 1 se comincia adesso, 0 da 14 giorni | 4 |

**Luoghi.** Un'attività ha un nome di luogo («Aula A1») e un indirizzo, cercato su
[Nominatim](https://nominatim.org/) tramite l'API (`GET /v1/luoghi`, `/v1/luoghi/inverso`), una
volta sola alla pubblicazione o alla modifica. Nel rispetto della
[policy del servizio](https://operations.osmfoundation.org/policies/nominatim/): una richiesta al
secondo, risultati in cache, ricerca da bottone e non mentre si scrive, User-Agent identificativo.
Leggere la bacheca non chiama servizi esterni; la mappa di openstreetmap.org compare solo con la rete.

**Senza rete.** Chi ha già aperto l'app sul dispositivo resta dentro e vede l'ultima copia dei dati.
Iscrizione, uscita e riconferma restano in sospeso su IndexedDB e partono al ritorno della rete;
pubblicare e modificare richiede la rete. Se nel frattempo l'attività è cambiata in modo maggiore,
l'iscrizione non passa in silenzio: l'app mostra la modifica e chiede se iscriversi lo stesso.

**Notifiche.** Web Push con chiavi VAPID: a chi organizza per iscrizioni e uscite, al primo della
lista quando si libera un posto, agli iscritti per modifiche, retrocessioni e annullamenti; a tempo,
3 ore prima della scadenza di una riconferma, alla scadenza e 2 ore prima dell'inizio.

## Altri comandi

| Comando | Cosa fa |
|---|---|
| `npm run build`, `npm run preview` | build di produzione e anteprima, dove si prova l'installazione |
| `npm run utente:test` | crea gli account di prova da `TEST_USER_EMAIL` |
| `npm run scenario -- AAAA-MM-GG` | scenario con le attività in programma da quel giorno (entro due mesi) |
| `npm run consolida` | aggiorna lo storico delle attività già cominciate, senza contarle due volte |
| `npm run job` | un giro delle operazioni a tempo, senza invii doppi |
| `npm run emulatori` | Auth e Firestore in locale (interfaccia su `http://127.0.0.1:4000`) |
| `npm run popola` | storico di prova sull'emulatore |
| `npm run deploy`, `npm run deploy:regole` | pubblica sito e regole su Firebase (dopo `npx firebase login`) |

Il sito pubblicato chiama l'API all'indirizzo in `VITE_API_BASE_URL`: con `http://localhost:3000`
funziona solo dove l'API è accesa. Il percorso principale resta quello locale.

## Struttura

```text
apps/web/          frontend: pagine, componenti, letture Firestore, coda offline, service worker
apps/api/          API Express: iscrizioni, modifiche, lista d'attesa, storico, luoghi, notifiche, job
apps/api/src/scripts/  comandi da terminale
packages/modello/  tipi e regole condivise da web e api
firestore.rules    regole di sicurezza: i client leggono, solo l'API scrive
firebase.json      hosting ed emulatori
```

## Attribuzioni

Dati dei luoghi da [OpenStreetMap](https://www.openstreetmap.org/copyright) tramite Nominatim —
© OpenStreetMap contributors, ODbL.

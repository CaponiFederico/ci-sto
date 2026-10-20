# Bacheca universitaria

Bacheca di ateneo per attività fra studenti: uno pubblica («calcetto 21:30, cerco
8 persone», «gruppo studio Analisi 2 giovedì»), gli altri si iscrivono. A posti
finiti si entra in lista d'attesa.

Chi pubblica riceve una notifica quando qualcuno entra;
chi si iscrive riceve il promemoria prima dell'inizio.

Nucleo:

- l'organizzatore può modificare data, ora, luogo e posti anche con iscritti
  presenti, e il sistema ne gestisce le conseguenze su iscritti, lista d'attesa
  e notifiche
- il tipo di lista d'attesa è decisa dall'organizzatore al momento della creazione
  dell'evento e non può essere modificata con utenti già in attesa.
- l'elenco delle attività ha un ordinamento personalizzato, che tiene conto
  dello storico dell'utente rispetto a luoghi, categorie e altri partecipanti.

---

## Requisiti

- Node.js ≥ 20 (sviluppato su 24.21.0 LTS)
- Java per l'emulatore Firestore (la Firebase CLI arriva con `npm install`)

## Avvio

```bash
git clone https://github.com/CaponiFederico/ci-sto.git
cd ci-sto
npm install
cp .env.example .env
```

Le variabili sono documentate in [`.env.example`](.env.example).

Il file `.env` non è versionato.

Le notifiche hanno bisogno di una coppia di chiavi, da generare una volta:

```bash
npx web-push generate-vapid-keys
```

La chiave pubblica va in `VITE_VAPID_PUBLIC_KEY`, quella privata in `VAPID_PRIVATE_KEY`.
Senza chiavi l'applicazione funziona lo stesso, con le notifiche spente.

Poi, in due terminali:

```bash
npm run dev:api
```

```bash
npm run dev:web
```

Il frontend risponde su `http://localhost:5173`

L'API su `http://localhost:3000`

## Credenziali di prova

Si entra con «Accedi con email e password». La password è la stessa per i tre account:
`prova-saw-2026`

| Account | Chi è | Cosa vede |
|---|---|---|
| `utente.test@bacheca.invalid` | è rimasto spesso in lista d'attesa; organizza «Ripasso Basi di dati» | uno storico, un'attività sua con iscritti, cinque liste d'attesa |
| `utente.test2@bacheca.invalid` | partecipa sempre con lo stesso gruppo; è iscritto a «Ripasso Basi di dati» | un ordine diverso della stessa bacheca |
| `utente.test3@bacheca.invalid` | non ha mai partecipato a niente | la bacheca di chi è appena arrivato |

Chi ha un indirizzo dei domini in `ALLOWED_EMAIL_DOMAINS` può entrare anche con «Accedi con Google».

Le altre persone che compaiono nelle attività sono d'esempio: hanno un nome e uno storico, non un
account. Ricaricare lo scenario riporta i primi due account allo stato iniziale; il terzo non viene
toccato, quindi è quello adatto a fare prove libere.

Gli account si creano con questo comando, dagli indirizzi in `TEST_USER_EMAIL` (separati da virgola,
elencati anche in `ALLOWED_EMAILS`) e con la password `TEST_USER_PASSWORD`:

```bash
npm run utente:test
```

### Cosa guardare

| Per vedere | Fare | Si vede |
|---|---|---|
| l'ordine personale | entrare come `utente.test`, passare da «Per data» a «Per te»; poi lo stesso come `utente.test2` e `utente.test3` | l'elenco cambia ordine, ogni scheda dice perché; per il terzo account, senza storico, conta quasi solo la data |
| le politiche della lista d'attesa | come `utente.test`, aprire i cinque «Calcetto (…)» | la stessa lista d'attesa in cinque ordini: con «Equità» è primo, con «Ordine d'arrivo» secondo, con «Rotazione» terzo; il dettaglio dice il motivo della posizione |
| la modifica con iscritti | come `utente.test`, in «Ripasso Basi di dati», portare i posti da 4 a 3 | l'ultimo iscritto perde il posto e va in testa alla lista d'attesa, davanti a chi c'era già |
| la riconferma | nella stessa attività, spostare l'orario di più di mezz'ora; poi entrare come `utente.test2` | chi aveva il posto deve riconfermare entro una scadenza |
| gli stati | come `utente.test`: «Cineforum», «Passaggio per Livorno», «Gruppo studio Analisi 2» | posto confermato; attività annullata; posti liberi |
| l'uso senza rete | togliere la rete e ricaricare; iscriversi a un'attività | elenco e proprie attività restano leggibili; l'iscrizione resta in sospeso e parte al ritorno della rete |
| le notifiche | come `utente.test` aprire «Profilo» e premere «Attiva le notifiche»; da un altro browser, come `utente.test3`, iscriversi a «Ripasso Basi di dati» | al primo arriva la notifica, anche con la scheda chiusa |

---

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

## Accesso

Si entra con Google (tramite account universitario .unipi.it .cnr.it) oppure con email e password.

Entra chi ha un indirizzo verificato in uno dei domini di `ALLOWED_EMAIL_DOMAINS`, o un indirizzo
elencato in `ALLOWED_EMAILS`. Il controllo lo fa l'API al primo accesso e segna l'account come
ammesso; le regole di Firestore guardano solo quel segno. Chi non è ammesso non legge e non scrive
niente.

## Modificare un'attività con iscritti

Chi organizza può cambiare un'attività anche quando ci sono già iscritti.

- Posti in più: entra chi è primo in lista d'attesa.
- Posti in meno: gli ultimi iscritti perdono il posto e vanno in testa alla lista, davanti a chi
  c'era già. Prima l'app chiede conferma.
- Orario spostato di più di 30 minuti, oppure luogo cambiato: chi ha il posto deve riconfermare
  entro 24 ore, o entro l'inizio se viene prima. Chi non lo fa perde il posto, che passa alla lista.
- Spostamenti più piccoli: gli iscritti vengono solo avvisati.
- Annullamento: l'attività resta visibile come annullata e non ci si può più iscrivere.

Ogni cambiamento compare nella cronologia dell'attività.

## Lista d'attesa

Chi pubblica sceglie come viene ordinata la lista d'attesa:

| Regola | Passa per primo |
|---|---|
| Ordine d'arrivo | chi si è messo in lista prima |
| Affinità | chi ha già partecipato più volte con chi ha il posto |
| Esplorazione | chi conosce meno il gruppo |
| Rotazione | chi non partecipa da più tempo |
| Equità | chi è rimasto escluso più volte |

A parità passa chi è arrivato prima. Chi è in lista vede la propria posizione e il motivo; il
motivo lo vede solo lui. La regola non si può cambiare finché c'è qualcuno in lista.

Lo storico su cui si basano le regole si aggiorna quando un'attività comincia.

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
posizione di chi guarda. Quest'ultima si imposta dal «Profilo»: è quella del dispositivo,
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

## Installazione

L'applicazione si può installare dal browser e aprire in una finestra sua. In locale l'installazione
si prova sulla build:

```bash
npm run build
npm run preview
```

## Notifiche

Si attivano dal «Profilo», con «Attiva le notifiche».

| Notifica | A chi | Quando |
|---|---|---|
| qualcuno si è iscritto, si è messo in lista o ha lasciato il posto | chi organizza | subito |
| si è liberato un posto | il primo della lista d'attesa | subito |
| orario o luogo sono cambiati | chi è iscritto; se il cambiamento è grande, con la richiesta di riconfermare | subito |
| i posti sono diminuiti | chi ha perso il posto | subito |
| l'attività è stata annullata | iscritti e lista d'attesa | subito |
| il posto è stato liberato | chi non ha riconfermato in tempo | alla scadenza |
| manca poco per riconfermare | chi non ha ancora riconfermato | 3 ore prima della scadenza |
| promemoria | chi ha il posto | 2 ore prima dell'inizio |

L'API le invia con Web Push(https://www.npmjs.com/package/web-push). Il messaggio viaggia cifrato fino al browser.
Se un dispositivo non esiste più, la sua registrazione viene cancellata. Uscendo dall'account il
dispositivo smette di ricevere.

Le ultime tre righe della tabella non nascono da una reazione ad un evento degli utenti, ma dal tempo.
Se ne occupa l'API stessa, all'avvio e poi ogni 5 minuti.

Questo comando fa un giro solo, e ripeterlo non manda niente due volte:

```bash
npm run job
```

Con l'API spenta promemoria e scadenze non partono. Al riavvio le scadenze passate vengono applicate;
un promemoria la cui attività è già cominciata no.

Su Brave le notifiche richiedono «Usa i servizi Google per la messaggistica push», in
`brave://settings/privacy`.

---

## Build

```bash
npm run build
npm run preview
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

Lo stesso storico si può caricare sul progetto, per avere una bacheca già popolata: diciotto
attività fra passate e in programma, con i due primi account di prova fra le persone che vi
partecipano. Le attività in programma cominciano da domani, o dal giorno indicato (entro due mesi).

```bash
npm run scenario
npm run scenario -- AAAA-MM-GG
```

Il comando va lanciato con l'API spenta e chiede di scrivere il nome del progetto. Ripeterlo toglie
le attività organizzate dalle persone d'esempio, comprese quelle pubblicate nel frattempo dai due
account di prova, e le ricrea.

## Emulatori

Autenticazione e Firestore in locale, senza toccare i dati veri. Richiede Java.

```bash
npm run emulatori
```

Interfaccia su `http://127.0.0.1:4000`, Authentication su 9099, Firestore su 8080.

## Deploy

Il progetto Firebase è indicato in `.firebaserc`. La prima volta serve autenticarsi:

```bash
npx firebase login
npm run deploy
```

Le regole di sicurezza si pubblicano a parte:

```bash
npm run deploy:regole
```

Il sito pubblicato (`https://bacheca-unipi-fc.web.app`) chiama l'API all'indirizzo scritto in
`VITE_API_BASE_URL` al momento della build. Con il valore dell'esempio risponde quindi solo sul
computer dove l'API è accesa, e la sua origine deve comparire in `CORS_ORIGINS`. Il percorso
principale per provare l'applicazione è quello locale descritto in «Avvio».

---

## Struttura

```text
apps/
  web/                    Vite + React + TypeScript
    src/App.tsx           accesso e scelta della pagina
    src/percorso.ts       navigazione: l'indirizzo dopo # decide la pagina
    src/pagine/           elenco, nuova attività, dettaglio, modifica, profilo
    src/componenti/       scheda, campi del modulo, luogo e ricerca, mappa, posizione, iscrizione, notifiche, conferma, nome
    src/dati.ts           letture da Firestore in tempo reale
    src/azioni.ts         scritture, sempre tramite l'API
    src/sospese.ts        richieste in sospeso, salvate su IndexedDB
    src/invio.ts          invio delle richieste in sospeso al ritorno della rete
    src/rete.ts           stato della connessione
    src/posizione.ts      posizione di chi guarda: dal dispositivo o da un indirizzo scelto
    src/notifiche.ts      permesso e registrazione del dispositivo alle notifiche
    src/stato-notifiche.ts  stato delle notifiche, condiviso fra profilo e dettaglio
    src/tema.ts           tema chiaro, scuro o del dispositivo, scelto nel profilo
    src/filtri.ts         filtri dell'elenco
    src/ordine.ts         ordine personale: pesi, punteggio, motivo
    src/testi.ts          messaggi per ogni stato ed esito
    src/sw.ts             service worker: precaching, fallback offline, notifiche in arrivo
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
    src/push.ts           invio di una notifica ai dispositivi di una persona
    src/avvisi.ts         da ciò che è successo a chi avvisare e con quale testo
    src/job.ts            operazioni a tempo: promemoria, scadenze, storico
    src/credenziali.ts    chiave del service account, dal .env o da un file
    src/scenario.ts       storico e attività d'esempio
    src/scripts/          comandi da terminale: account di prova, scenario, consolidamento, job
packages/
  modello/                tipi, costanti e regole condivise da web e api
firebase.json             hosting, regole Firestore, emulatori
firestore.rules           regole di sicurezza: i client leggono, solo l'API scrive
firestore.indexes.json    indici composti, vuoto finché non servono
```

## Licenza e attribuzioni

I dati dei luoghi provengono da [OpenStreetMap](https://www.openstreetmap.org/copyright)
tramite Nominatim — © OpenStreetMap contributors, ODbL.

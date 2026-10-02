// Le richieste fatte senza rete, in attesa di partire
// Stanno in IndexedDB: sopravvivono a una ricarica

export type AzioneSospesa = 'iscrivi' | 'lascia' | 'riconferma';

// La risposta del server
export interface Rifiuto {
  testo: string;
  // L'attività è cambiata in modo importante
  // si può scegliere di iscriversi lo stesso
  cambiata: boolean;
}

export interface Sospesa {
  // L'attività a cui si riferisce
  idAttivita: string;
  // Di chi è
  uid: string;
  azione: AzioneSospesa;
  versioneVista: number;
  titolo: string;
  creataIl: number;
  rifiuto?: Rifiuto;
}

const NOME = 'bacheca';
const VERSIONE = 1;
const DEPOSITO = 'sospese';

// Una richiesta IndexedDB diventa una promise
function promessa<T>(richiesta: IDBRequest<T>) {
  return new Promise<T>((risolvi, rifiuta) => {
    richiesta.onsuccess = () => risolvi(richiesta.result);
    richiesta.onerror = () => rifiuta(richiesta.error);
  });
}

let aperto: Promise<IDBDatabase> | undefined;

function apri() {
  if (!aperto) {
    const richiesta = indexedDB.open(NOME, VERSIONE);
    richiesta.onupgradeneeded = () => {
      richiesta.result.createObjectStore(DEPOSITO, { keyPath: 'idAttivita' });
    };
    aperto = promessa(richiesta);
  }
  return aperto;
}

async function deposito(modo: IDBTransactionMode) {
  const db = await apri();
  return db.transaction(DEPOSITO, modo).objectStore(DEPOSITO);
}

const ascoltatori = new Set<() => void>();

// Chi si iscrive riceve una funzione per annullare l'iscrizione
export function ascolta(avvisa: () => void) {
  ascoltatori.add(avvisa);
  return () => {
    ascoltatori.delete(avvisa);
  };
}

function cambiata() {
  for (const avvisa of ascoltatori) avvisa();
}

// se per quell'attività c'era già una richiesta la sostituisce
export async function metti(sospesa: Sospesa) {
  await promessa((await deposito('readwrite')).put(sospesa));
  // Chiede al browser di non cancellare questi dati quando lo spazio scarseggia
  void navigator.storage?.persist?.();
  cambiata();
}

export async function togli(idAttivita: string) {
  await promessa((await deposito('readwrite')).delete(idAttivita));
  cambiata();
}

// Solo quelle dell'utente indicato
export async function tutte(uid: string) {
  const lette = await promessa<Sospesa[]>((await deposito('readonly')).getAll());
  return lette.filter((s) => s.uid === uid).sort((a, b) => a.creataIl - b.creataIl);
}

export async function svuota() {
  await promessa((await deposito('readwrite')).clear());
  cambiata();
}

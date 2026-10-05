import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { COLLEZIONI, SOTTOCOLLEZIONI, type Sottoscrizione } from 'modello';
import { db } from './firebase';

export type StatoNotifiche = 'non_supportate' | 'spente' | 'attive' | 'negate';

export const SERVIZIO_NON_RAGGIUNTO = 'servizio_non_raggiunto';

const CHIAVE = import.meta.env.VITE_VAPID_PUBLIC_KEY;

function supportate() {
  return Boolean(CHIAVE) && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

function inOttetti(chiave: string) {
  const base64 = chiave.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
}

async function riferimento(uid: string, endpoint: string) {
  const impronta = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  const id = Array.from(new Uint8Array(impronta), (b) => b.toString(16).padStart(2, '0')).join('');
  return doc(db, COLLEZIONI.sottoscrizioni, uid, SOTTOCOLLEZIONI.dispositivi, id.slice(0, 40));
}

async function attuale() {
  const registrazione = await navigator.serviceWorker.getRegistration();
  return (await registrazione?.pushManager.getSubscription()) ?? null;
}

// È l'unica scrittura che il browser fa direttamente su Firestore
async function salva(uid: string, sottoscrizione: PushSubscription) {
  const { endpoint, keys } = sottoscrizione.toJSON();
  if (!endpoint || !keys?.p256dh || !keys.auth) throw new Error('sottoscrizione incompleta');

  const dati: Sottoscrizione = { endpoint, chiavi: { p256dh: keys.p256dh, auth: keys.auth }, creataIl: Date.now() };
  await setDoc(await riferimento(uid, endpoint), dati);
}

// Se la sottoscrizione c'è già la riscrive
export async function statoNotifiche(uid: string): Promise<StatoNotifiche> {
  if (!supportate()) return 'non_supportate';
  if (Notification.permission === 'denied') return 'negate';

  const sottoscrizione = await attuale();
  if (!sottoscrizione) return 'spente';
  await salva(uid, sottoscrizione).catch(() => {});
  return 'attive';
}

export async function attivaNotifiche(uid: string): Promise<StatoNotifiche> {
  if (!supportate()) return 'non_supportate';

  const permesso = await Notification.requestPermission();
  if (permesso !== 'granted') return permesso === 'denied' ? 'negate' : 'spente';

  const registrazione = await navigator.serviceWorker.ready;
  let sottoscrizione: PushSubscription;
  try {
    sottoscrizione = await registrazione.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: inOttetti(CHIAVE),
    });
  } catch (errore) {
    console.error('sottoscrizione alle notifiche non riuscita:', errore);
    throw new Error(SERVIZIO_NON_RAGGIUNTO);
  }
  await salva(uid, sottoscrizione);
  return 'attive';
}

// Il dispositivo smette di ricevere
export async function disattivaNotifiche(uid: string) {
  if (!supportate()) return;
  const sottoscrizione = await attuale();
  if (!sottoscrizione) return;

  // Non si aspetta che la cancellazione vada a buon fine: se non c'è rete il browser non deve restare appeso
  void riferimento(uid, sottoscrizione.endpoint).then((r) => deleteDoc(r).catch(() => {}));
  await sottoscrizione.unsubscribe();
}

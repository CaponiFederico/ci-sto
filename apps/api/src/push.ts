import webpush from 'web-push';
import { COLLEZIONI, SOTTOCOLLEZIONI, type Notifica, type Sottoscrizione } from 'modello';
import { db } from './firestore.js';


export type Mittente = (sottoscrizione: Sottoscrizione, corpo: string) => Promise<unknown>;

// I servizi di push dei browser
const SERVIZI = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

const CONTATTO = 'https://github.com/CaponiFederico/ci-sto';

const DURATA_SECONDI = 4 * 60 * 60;

function fidato(endpoint: string) {
  try {
    const { protocol, hostname } = new URL(endpoint);
    return protocol === 'https:' && SERVIZI.some((s) => hostname === s || hostname.endsWith(`.${s}`));
  } catch {
    return false;
  }
}

// Senza chiavi le notifiche restano spente
function mittenteVero(): Mittente | null {
  const pubblica = process.env.VITE_VAPID_PUBLIC_KEY;
  const privata = process.env.VAPID_PRIVATE_KEY;
  if (!pubblica || !privata) return null;

  try {
    // La chiave privata firma ogni invio
    webpush.setVapidDetails(CONTATTO, pubblica, privata);
  } catch (errore) {
    console.warn('chiavi VAPID non valide, notifiche spente:', (errore as Error).message);
    return null;
  }

  return (s, corpo) =>
    webpush.sendNotification({ endpoint: s.endpoint, keys: s.chiavi }, corpo, { TTL: DURATA_SECONDI });
}

export interface Invio {
  inviate: number;
  tolte: number;
}

export function creaInvio(mittente: Mittente | null) {
  return async function invia(uid: string, notifica: Notifica): Promise<Invio> {
    const esito: Invio = { inviate: 0, tolte: 0 };
    if (!mittente) return esito;

    try {
      const dispositivi = await db
        .collection(COLLEZIONI.sottoscrizioni)
        .doc(uid)
        .collection(SOTTOCOLLEZIONI.dispositivi)
        .get();
      const corpo = JSON.stringify(notifica);

      // più dispositivi a ciascuno il suo invio
      await Promise.all(
        dispositivi.docs.map(async (d) => {
          const sottoscrizione = d.data() as Sottoscrizione;
          if (!fidato(sottoscrizione.endpoint)) return;

          try {
            await mittente(sottoscrizione, corpo);
            esito.inviate += 1;
          } catch (errore) {
            // 404 e 410: il browser ha revocato la sottoscrizione
            const stato = (errore as { statusCode?: number }).statusCode;
            if (stato === 404 || stato === 410) {
              await d.ref.delete();
              esito.tolte += 1;
            } else {
              console.warn(`notifica non inviata (${stato ?? 'errore di rete'})`);
            }
          }
        }),
      );
    } catch (errore) {
      console.warn('notifiche non inviate:', (errore as Error).message);
    }

    return esito;
  };
}

export const invia = creaInvio(mittenteVero());

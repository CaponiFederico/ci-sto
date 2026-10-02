import {
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { chiamaApi } from './api';
import { auth } from './firebase';

const google = new GoogleAuthProvider();

// Senza, Google riusa l'ultimo account senza chiedere nulla.
google.setCustomParameters({ prompt: 'select_account' });

export interface Sessione {
  ateneo: true;
  email: string;
  aggiornaToken: boolean;
}

export function accediConGoogle() {
  return signInWithPopup(auth, google);
}

export function accediConPassword(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

// Chi ha aperto la sessione su questo dispositivo
const RICORDO = 'bacheca:sessione';

export async function apriSessione() {
  const sessione = await chiamaApi<Sessione>('/v1/session', { method: 'POST' });

  // Il claim vive dentro il token: senza rinnovarlo le regole non lo vedrebbero per un'ora.
  if (sessione.aggiornaToken) await auth.currentUser?.getIdToken(true);

  if (auth.currentUser) localStorage.setItem(RICORDO, auth.currentUser.uid);
  return sessione;
}

// Chi ha aperto la sessione su questo dispositivo
export function sessioneRicordata(uid: string) {
  return localStorage.getItem(RICORDO) === uid;
}

export function esci() {
  localStorage.removeItem(RICORDO);
  return signOut(auth);
}

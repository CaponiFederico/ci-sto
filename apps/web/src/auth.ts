import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from './firebase';

const google = new GoogleAuthProvider();

// Senza, Google riusa l'ultimo account senza chiedere nulla.
google.setCustomParameters({ prompt: 'select_account' });

export function accediConGoogle() {
  return signInWithPopup(auth, google);
}

export function esci() {
  return signOut(auth);
}

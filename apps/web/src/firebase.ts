import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const configurazione = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Una VITE_* mancante diventa undefined e Firebase fallirebbe 
for (const [chiave, valore] of Object.entries(configurazione)) {
  if (!valore) throw new Error(`configurazione Firebase incompleta: manca ${chiave}`);
}

export const app = initializeApp(configurazione);
export const auth = getAuth(app);
export const db = getFirestore(app);

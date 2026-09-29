import { getFirestore } from 'firebase-admin/firestore';
import { app } from './firebase.js';

export const db = getFirestore(app);

// Sotto contesa conflitti 
export const TENTATIVI = 10;

// Gli id creati da Firestore sono alfanumerici: '..', 'a/b' o '__x__' 
export const ID_ATTIVITA = /^[A-Za-z0-9]{1,100}$/;

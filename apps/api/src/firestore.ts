import { getFirestore } from 'firebase-admin/firestore';
import { app } from './firebase.js';

export const db = getFirestore(app);

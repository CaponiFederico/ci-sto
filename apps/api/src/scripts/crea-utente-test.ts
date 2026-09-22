import '../ambiente.js';

import { appartieneAllAteneo } from '../auth.js';
import { auth } from '../firebase.js';

const email = process.env.TEST_USER_EMAIL;
const password = process.env.TEST_USER_PASSWORD;

if (!email || !password) {
  console.error('servono TEST_USER_EMAIL e TEST_USER_PASSWORD nel .env');
  process.exit(1);
}

// Un account che le liste non ammettono verrebbe respinto da /v1/session
if (!appartieneAllAteneo(email)) {
  console.error(`${email} non è in ALLOWED_EMAILS né in ALLOWED_EMAIL_DOMAINS`);
  process.exit(1);
}

const esistente = await auth.getUserByEmail(email).catch(() => null);

const utente = esistente
  ? await auth.updateUser(esistente.uid, { password, emailVerified: true })
  : await auth.createUser({ email, password, emailVerified: true, displayName: 'Utente di prova' });

await auth.setCustomUserClaims(utente.uid, { ateneo: true });

console.log(`${esistente ? 'aggiornato' : 'creato'}: ${email} (uid ${utente.uid})`);

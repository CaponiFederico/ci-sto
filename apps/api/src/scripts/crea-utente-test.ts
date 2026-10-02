import '../ambiente.js';

import { appartieneAllAteneo } from '../auth.js';
import { auth } from '../firebase.js';

const indirizzi = (process.env.TEST_USER_EMAIL ?? '')
  .split(',')
  .map((e) => e.trim())
  .filter(Boolean);
const password = process.env.TEST_USER_PASSWORD;

if (indirizzi.length === 0 || !password) {
  console.error('servono TEST_USER_EMAIL e TEST_USER_PASSWORD nel .env');
  process.exit(1);
}

// Un account che le liste non ammettono verrebbe respinto da /v1/session
const respinti = indirizzi.filter((email) => !appartieneAllAteneo(email));
if (respinti.length > 0) {
  console.error(`non in ALLOWED_EMAILS né in ALLOWED_EMAIL_DOMAINS: ${respinti.join(', ')}`);
  process.exit(1);
}

for (const [i, email] of indirizzi.entries()) {
  const displayName = i === 0 ? 'Utente di prova' : `Utente di prova ${i + 1}`;
  const esistente = await auth.getUserByEmail(email).catch(() => null);

  const utente = esistente
    ? await auth.updateUser(esistente.uid, { password, emailVerified: true, displayName })
    : await auth.createUser({ email, password, emailVerified: true, displayName });

  await auth.setCustomUserClaims(utente.uid, { ateneo: true });

  console.log(`${esistente ? 'aggiornato' : 'creato'}: ${email} (uid ${utente.uid})`);
}

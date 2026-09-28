import { svuotaAuth, svuotaFirestore } from './emulatore.mjs';

import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { app } from '../apps/api/dist/app.js';
import { auth } from '../apps/api/dist/firebase.js';
import { db } from '../apps/api/dist/firestore.js';
import { attivitaValida } from './dati.mjs';

let server;
let base;
const token = {};

// Utente sull'emulatore Auth e il suo ID token, come lo otterrebbe il client.
async function accedi(nome, ateneo) {
  const email = `${nome}@studenti.unipi.it`;
  const { uid } = await auth.createUser({ email, password: 'password-di-prova', emailVerified: true });
  if (ateneo) await auth.setCustomUserClaims(uid, { ateneo: true });

  const risposta = await fetch(
    `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulatore`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password: 'password-di-prova', returnSecureToken: true }),
    },
  );
  return { uid, idToken: (await risposta.json()).idToken };
}

async function chiama(metodo, percorso, utente, corpo) {
  const risposta = await fetch(base + percorso, {
    method: metodo,
    headers: {
      'content-type': 'application/json',
      ...(utente && { authorization: `Bearer ${utente.idToken}` }),
    },
    body: corpo && JSON.stringify(corpo),
  });
  return { status: risposta.status, corpo: await risposta.json() };
}

async function nuovaAttivita() {
  const inizio = Date.now() + 24 * 60 * 60 * 1000;
  const { corpo } = await chiama('POST', '/v1/attivita', token.manuela, { ...attivitaValida, inizio });
  return `/v1/attivita/${corpo.id}/iscrizione`;
}

before(async () => {
  await svuotaAuth();
  token.manuela = await accedi('manuela', true);
  token.michele = await accedi('michele', true);
  token.estraneo = await accedi('estraneo', false);

  // Porta 0: la sceglie il sistema, nessun conflitto con un'API già avviata.
  server = app.listen(0);
  base = `http://localhost:${server.address().port}`;
});
beforeEach(svuotaFirestore);
after(async () => {
  server.close();
  await db.terminate();
});

describe('rotte di iscrizione', () => {
  it('senza token rispondono 401', async () => {
    assert.equal((await chiama('POST', '/v1/attivita/x/iscrizione')).status, 401);
  });

  it('senza il claim ateneo rispondono 403', async () => {
    const percorso = await nuovaAttivita();
    assert.deepEqual(await chiama('POST', percorso, token.estraneo), {
      status: 403,
      corpo: { error: 'non_ammesso' },
    });
  });

  it("iscrivono e fanno uscire chi possiede il token, qualunque uid dica il corpo", async () => {
    const percorso = await nuovaAttivita();
    const iscrizione = await chiama('POST', percorso, token.michele, { uid: token.manuela.uid });
    assert.deepEqual(iscrizione, { status: 200, corpo: { esito: 'confermato' } });

    const id = percorso.split('/')[3];
    const partecipanti = await db.collection('attivita').doc(id).collection('partecipanti').get();
    assert.deepEqual(partecipanti.docs.map((d) => d.id).sort(), [token.manuela.uid, token.michele.uid].sort());

    assert.deepEqual(await chiama('DELETE', percorso, token.michele), {
      status: 200,
      corpo: { esito: 'uscito', promosso: null },
    });
  });

  it('restituiscono il rifiuto come esito, con 200', async () => {
    const percorso = await nuovaAttivita();
    assert.deepEqual(await chiama('DELETE', percorso, token.manuela), {
      status: 200,
      corpo: { esito: 'rifiutato', motivo: 'organizzatore' },
    });
  });

  it('con un id malformato rispondono con un esito, non con 500', async () => {
    const risposta = await chiama('POST', '/v1/attivita/a%2Fb/iscrizione', token.michele);
    assert.deepEqual(risposta, { status: 200, corpo: { esito: 'rifiutato', motivo: 'inesistente' } });
  });
});

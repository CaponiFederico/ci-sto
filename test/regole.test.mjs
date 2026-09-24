import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';

import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc } from 'firebase/firestore';

const MANUELA = 'manuela';
const MICHELE = 'michele';

let ambiente;
let manuela;
let michele;
let senzaClaim;
let anonimo;

before(async () => {
  ambiente = await initializeTestEnvironment({
    projectId: 'bacheca-prova',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
  });

  manuela = ambiente.authenticatedContext(MANUELA, { ateneo: true }).firestore();
  michele = ambiente.authenticatedContext(MICHELE, { ateneo: true }).firestore();
  senzaClaim = ambiente.authenticatedContext('estraneo').firestore();
  anonimo = ambiente.unauthenticatedContext().firestore();

  // Scritture di preparazione: qui le regole sono disattivate, come farebbe l'API.
  await ambiente.withSecurityRulesDisabled(async (contesto) => {
    const db = contesto.firestore();
    await setDoc(doc(db, 'utenti', MANUELA), { email: 'manuela@studenti.unipi.it' });
    await setDoc(doc(db, 'attivita', 'calcetto'), { titolo: 'Calcetto', capacita: 8, postiOccupati: 0 });
    await setDoc(doc(db, 'attivita', 'calcetto', 'partecipanti', MICHELE), { stato: 'confermato' });
    await setDoc(doc(db, 'attivita', 'calcetto', 'eventi', 'e1'), { tipo: 'iscritto' });
    await setDoc(doc(db, 'statistiche', MANUELA), { partecipazioni: 3, escluso: 1 });
  });
});

after(() => ambiente.cleanup());

describe('chi non appartiene all ateneo', () => {
  it('non legge la bacheca da anonimo', async () => {
    await assertFails(getDocs(collection(anonimo, 'attivita')));
  });

  it('non legge la bacheca autenticato senza il claim', async () => {
    await assertFails(getDoc(doc(senzaClaim, 'attivita', 'calcetto')));
  });
});

describe('chi appartiene all ateneo', () => {
  it('legge la bacheca', async () => {
    await assertSucceeds(getDocs(collection(manuela, 'attivita')));
  });

  it('legge i partecipanti e il diario', async () => {
    await assertSucceeds(getDoc(doc(manuela, 'attivita', 'calcetto', 'partecipanti', MICHELE)));
    await assertSucceeds(getDocs(collection(manuela, 'attivita', 'calcetto', 'eventi')));
  });

  it('legge il profilo di un altro utente', async () => {
    await assertSucceeds(getDoc(doc(michele, 'utenti', MANUELA)));
  });
});

describe('nessun client scrive lo stato conteso', () => {
  it('non crea un attivita', async () => {
    await assertFails(setDoc(doc(manuela, 'attivita', 'nuova'), { titolo: 'X', capacita: 4 }));
  });

  it('non modifica il contatore dei posti', async () => {
    await assertFails(setDoc(doc(manuela, 'attivita', 'calcetto'), { postiOccupati: 99 }, { merge: true }));
  });

  it('non si iscrive scrivendo fra i partecipanti', async () => {
    await assertFails(
      setDoc(doc(manuela, 'attivita', 'calcetto', 'partecipanti', MANUELA), { stato: 'confermato' }),
    );
  });

  it('non scrive nel diario', async () => {
    await assertFails(setDoc(doc(manuela, 'attivita', 'calcetto', 'eventi', 'falso'), { tipo: 'promosso' }));
  });
});

describe('statistiche personali', () => {
  it('il proprietario le legge', async () => {
    const istantanea = await assertSucceeds(getDoc(doc(manuela, 'statistiche', MANUELA)));
    assert.equal(istantanea.data().escluso, 1);
  });

  it('un altro utente non le legge', async () => {
    await assertFails(getDoc(doc(michele, 'statistiche', MANUELA)));
  });

  it('il proprietario non le scrive', async () => {
    await assertFails(setDoc(doc(manuela, 'statistiche', MANUELA), { escluso: 100 }, { merge: true }));
  });
});

describe('sottoscrizioni alle notifiche', () => {
  const valida = {
    endpoint: 'https://push.example/abc',
    chiavi: { p256dh: 'chiave', auth: 'segreto' },
    creataIl: 1_700_000_000_000,
  };

  it('il proprietario crea la propria', async () => {
    await assertSucceeds(
      setDoc(doc(manuela, 'sottoscrizioni', MANUELA, 'dispositivi', 'telefono'), valida),
    );
  });

  it('il proprietario cancella la propria', async () => {
    await assertSucceeds(deleteDoc(doc(manuela, 'sottoscrizioni', MANUELA, 'dispositivi', 'telefono')));
  });

  it('non scrive quella di un altro', async () => {
    await assertFails(
      setDoc(doc(michele, 'sottoscrizioni', MANUELA, 'dispositivi', 'telefono'), valida),
    );
  });

  it('rifiuta campi estranei', async () => {
    await assertFails(
      setDoc(doc(manuela, 'sottoscrizioni', MANUELA, 'dispositivi', 'telefono'), {
        ...valida,
        ruolo: 'amministratore',
      }),
    );
  });

  it('rifiuta chiavi di forma sbagliata', async () => {
    await assertFails(
      setDoc(doc(manuela, 'sottoscrizioni', MANUELA, 'dispositivi', 'telefono'), {
        ...valida,
        chiavi: { p256dh: 'chiave', auth: 'segreto', extra: 'x' },
      }),
    );
  });
});

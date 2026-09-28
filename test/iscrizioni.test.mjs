import { svuotaFirestore } from './emulatore.mjs';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it } from 'node:test';

import { iscrivi } from '../apps/api/dist/iscrizioni.js';
import { db } from '../apps/api/dist/firestore.js';
import { ADESSO, DOMANI, attivitaDiProva, studenti } from './dati.mjs';

const attivita = (id) => db.collection('attivita').doc(id);


async function verificaInvarianti(id) {
  const { capacita, postiOccupati } = (await attivita(id).get()).data();
  const confermati = await attivita(id).collection('partecipanti').where('stato', '==', 'confermato').get();
  assert.equal(postiOccupati, confermati.size);
  assert.ok(postiOccupati <= capacita);
}

async function iscriviInSequenza(id, uid) {
  const esiti = [];
  for (const [i, u] of uid.entries()) esiti.push(await iscrivi(id, u, ADESSO + i));
  return esiti;
}

let id;

beforeEach(svuotaFirestore);
afterEach(() => id && verificaInvarianti(id));
after(() => db.terminate());

describe('iscrizione', () => {
  it('conferma se ci sono posti liberi', async () => {
    id = await attivitaDiProva();
    assert.deepEqual(await iscrivi(id, 'michele', ADESSO), { esito: 'confermato' });

    const { postiOccupati, stato } = (await attivita(id).get()).data();
    assert.equal(postiOccupati, 2);
    assert.equal(stato, 'aperta');
  });

  it("l'ultimo posto rende l'attività completa", async () => {
    id = await attivitaDiProva({ capacita: 2 });
    await iscriviInSequenza(id, studenti(1));
    assert.equal((await attivita(id).get()).data().stato, 'completa');
  });

  it('a posti finiti mette in coda, in ordine di arrivo', async () => {
    id = await attivitaDiProva({ capacita: 3 });
    const esiti = await iscriviInSequenza(id, studenti(4));
    assert.deepEqual(esiti.slice(2), [
      { esito: 'in_attesa', posizione: 1 },
      { esito: 'in_attesa', posizione: 2 },
    ]);
    assert.equal((await attivita(id).get()).data().postiOccupati, 3);
  });

  it('registra ogni iscrizione nel diario', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    await iscriviInSequenza(id, studenti(3));
    const eventi = await attivita(id).collection('eventi').where('tipo', '==', 'iscritto').get();
    assert.equal(eventi.size, 4);
  });
});

describe('richiesta ripetuta', () => {
  it('da confermato restituisce lo stesso esito senza toccare il contatore', async () => {
    id = await attivitaDiProva();
    await iscrivi(id, 'michele', ADESSO);
    assert.deepEqual(await iscrivi(id, 'michele', ADESSO + 1), { esito: 'confermato' });

    assert.equal((await attivita(id).get()).data().postiOccupati, 2);
    assert.equal((await attivita(id).collection('partecipanti').get()).size, 2);
    assert.equal((await attivita(id).collection('eventi').where('tipo', '==', 'iscritto').get()).size, 2);
  });

  it("dall'organizzatore conferma senza occupare un altro posto", async () => {
    id = await attivitaDiProva({}, 'manuela');
    assert.deepEqual(await iscrivi(id, 'manuela', ADESSO), { esito: 'confermato' });
    assert.equal((await attivita(id).get()).data().postiOccupati, 1);
  });

  it('da in coda restituisce la stessa posizione', async () => {
    id = await attivitaDiProva({ capacita: 3 });
    const [, , , quarto] = studenti(4);
    await iscriviInSequenza(id, studenti(4));
    assert.deepEqual(await iscrivi(id, quarto, ADESSO + 10), { esito: 'in_attesa', posizione: 2 });
  });
});

describe('rifiuto', () => {
  it("se l'attività non esiste", async () => {
    id = undefined;
    assert.deepEqual(await iscrivi('inesistente', 'michele', ADESSO), {
      esito: 'rifiutato',
      motivo: 'inesistente',
    });
  });

  it("se l'attività è annullata", async () => {
    id = await attivitaDiProva();
    await attivita(id).update({ stato: 'annullata' });
    assert.deepEqual(await iscrivi(id, 'michele', ADESSO), { esito: 'rifiutato', motivo: 'annullata' });
  });

  it("se l'attività è già iniziata", async () => {
    id = await attivitaDiProva();
    assert.deepEqual(await iscrivi(id, 'michele', DOMANI), { esito: 'rifiutato', motivo: 'iniziata' });
  });
});

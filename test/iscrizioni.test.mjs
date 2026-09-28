import { svuotaFirestore } from './emulatore.mjs';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it } from 'node:test';

import { iscrivi } from '../apps/api/dist/iscrizioni.js';
import { db } from '../apps/api/dist/firestore.js';
import { ADESSO, DOMANI, attivitaDiProva, studenti } from './dati.mjs';

const attivita = (id) => db.collection('attivita').doc(id);


async function verificaInvarianti(id) {
  const { capacita, postiOccupati, inAttesa } = (await attivita(id).get()).data();
  const partecipanti = attivita(id).collection('partecipanti');
  const confermati = await partecipanti.where('stato', '==', 'confermato').get();
  const inCoda = await partecipanti.where('stato', '==', 'in_attesa').get();
  assert.equal(postiOccupati, confermati.size);
  assert.equal(inAttesa, inCoda.size);
  assert.ok(postiOccupati <= capacita);
}

async function iscriviInSequenza(id, uid) {
  const esiti = [];
  for (const [i, u] of uid.entries()) esiti.push(await iscrivi(id, u, () => ADESSO + i));
  return esiti;
}

let id;

beforeEach(svuotaFirestore);
afterEach(() => id && verificaInvarianti(id));
after(() => db.terminate());

describe('iscrizione', () => {
  it('conferma se ci sono posti liberi', async () => {
    id = await attivitaDiProva();
    assert.deepEqual(await iscrivi(id, 'michele', () => ADESSO), { esito: 'confermato' });

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
    await iscrivi(id, 'michele', () => ADESSO);
    assert.deepEqual(await iscrivi(id, 'michele', () => ADESSO + 1), { esito: 'confermato' });

    assert.equal((await attivita(id).get()).data().postiOccupati, 2);
    assert.equal((await attivita(id).collection('partecipanti').get()).size, 2);
    assert.equal((await attivita(id).collection('eventi').where('tipo', '==', 'iscritto').get()).size, 2);
  });

  it("dall'organizzatore conferma senza occupare un altro posto", async () => {
    id = await attivitaDiProva({}, 'manuela');
    assert.deepEqual(await iscrivi(id, 'manuela', () => ADESSO), { esito: 'confermato' });
    assert.equal((await attivita(id).get()).data().postiOccupati, 1);
  });

  it('da in coda restituisce la stessa posizione', async () => {
    id = await attivitaDiProva({ capacita: 3 });
    const [, , , quarto] = studenti(4);
    await iscriviInSequenza(id, studenti(4));
    assert.deepEqual(await iscrivi(id, quarto, () => ADESSO + 10), { esito: 'in_attesa', posizione: 2 });
  });
});

describe('rifiuto', () => {
  it("se l'attività non esiste", async () => {
    id = undefined;
    assert.deepEqual(await iscrivi('inesistente', 'michele', () => ADESSO), {
      esito: 'rifiutato',
      motivo: 'inesistente',
    });
  });

  it("se l'attività è annullata", async () => {
    id = await attivitaDiProva();
    await attivita(id).update({ stato: 'annullata' });
    assert.deepEqual(await iscrivi(id, 'michele', () => ADESSO), { esito: 'rifiutato', motivo: 'annullata' });
  });

  it("se l'attività è già iniziata", async () => {
    id = await attivitaDiProva();
    assert.deepEqual(await iscrivi(id, 'michele', () => DOMANI), { esito: 'rifiutato', motivo: 'iniziata' });
  });
});

// npm imposta il nome dello script: 20 giri solo con npm run test:concorrenza.
const GIRI = process.env.npm_lifecycle_event === 'test:concorrenza' ? 20 : 3;

describe('concorrenza', () => {
  // Crescente e senza doppioni: l'ordine d'arrivo lo decide chi vince i conflitti
  let istante = ADESSO;
  const orologio = () => ++istante;

  it(`12 iscrizioni simultanee su 8 posti liberi, ${GIRI} giri: 8 confermati e 4 in coda`, async () => {
    for (let giro = 1; giro <= GIRI; giro++) {
      id = await attivitaDiProva({ capacita: 9 });
      const iscritti = studenti(12);
      const esiti = await Promise.all(iscritti.map((u) => iscrivi(id, u, orologio)));

      const confermati = esiti.filter((e) => e.esito === 'confermato');
      const posizioni = esiti.filter((e) => e.esito === 'in_attesa').map((e) => e.posizione);
      assert.equal(confermati.length, 8, `giro ${giro}`);
      assert.deepEqual(posizioni.sort((a, b) => a - b), [1, 2, 3, 4], `giro ${giro}`);

      for (const [i, esito] of esiti.entries()) {
        if (esito.esito === 'in_attesa') assert.deepEqual(await iscrivi(id, iscritti[i], orologio), esito);
      }

      const { postiOccupati, stato } = (await attivita(id).get()).data();
      assert.equal(postiOccupati, 9, `giro ${giro}`);
      assert.equal(stato, 'completa', `giro ${giro}`);
      await verificaInvarianti(id);
    }
  });
});

import { svuotaFirestore } from './emulatore.mjs';

import assert from 'node:assert/strict';
import { after, afterEach, beforeEach, describe, it } from 'node:test';

import { esci, iscrivi } from '../apps/api/dist/iscrizioni.js';
import { db } from '../apps/api/dist/firestore.js';
import { ADESSO, DOMANI, attivitaDiProva, studenti } from './dati.mjs';

const attivita = (id) => db.collection('attivita').doc(id);


async function verificaInvarianti(id) {
  const { capacita, postiOccupati, inAttesa, daConfermare } = (await attivita(id).get()).data();
  const partecipanti = attivita(id).collection('partecipanti');
  const conta = async (stato) => (await partecipanti.where('stato', '==', stato).get()).size;
  const daRiconfermare = await conta('da_confermare');
  // Chi deve riconfermare tiene il posto fino alla scadenza.
  assert.equal(postiOccupati, (await conta('confermato')) + daRiconfermare);
  assert.equal(daConfermare, daRiconfermare);
  assert.equal(inAttesa, await conta('in_attesa'));
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

const ID_MALFORMATI = ['..', 'a/b', '__x__', ''];

describe('rifiuto', () => {
  it("se l'id non può essere di un'attività", async () => {
    id = undefined;
    for (const malformato of ID_MALFORMATI) {
      assert.deepEqual(await iscrivi(malformato, 'michele', () => ADESSO), {
        esito: 'rifiutato',
        motivo: 'inesistente',
      });
    }
  });

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

const partecipante = async (id, uid) => (await attivita(id).collection('partecipanti').doc(uid).get()).data();
const eventiDi = async (id, tipo) =>
  (await attivita(id).collection('eventi').where('tipo', '==', tipo).get()).docs.map((d) => d.get('utente'));

describe('uscita', () => {
  it('da confermato, con la coda vuota, libera il posto e riapre l attività', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    await iscrivi(id, 'michele', () => ADESSO);
    assert.deepEqual(await esci(id, 'michele', () => ADESSO + 1), { esito: 'uscito', promosso: null });

    const { postiOccupati, stato } = (await attivita(id).get()).data();
    assert.equal(postiOccupati, 1);
    assert.equal(stato, 'aperta');
    assert.equal(await partecipante(id, 'michele'), undefined);
    assert.deepEqual(await eventiDi(id, 'uscito'), ['michele']);
  });

  it('da confermato promuove il primo arrivato in coda, senza cambiare il contatore', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    const [primo, secondo, terzo] = studenti(3);
    await iscriviInSequenza(id, [primo, secondo, terzo]);

    assert.deepEqual(await esci(id, primo, () => ADESSO + 10), { esito: 'uscito', promosso: secondo });

    const { postiOccupati, inAttesa, stato } = (await attivita(id).get()).data();
    assert.equal(postiOccupati, 2);
    assert.equal(inAttesa, 1);
    assert.equal(stato, 'completa');
    assert.equal((await partecipante(id, secondo)).stato, 'confermato');
    assert.deepEqual(await iscrivi(id, terzo, () => ADESSO + 11), { esito: 'in_attesa', posizione: 1 });
    assert.deepEqual(await eventiDi(id, 'promosso'), [secondo]);
  });

  it('dalla coda non promuove nessuno e fa avanzare chi sta dietro', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    const [primo, secondo, terzo] = studenti(3);
    await iscriviInSequenza(id, [primo, secondo, terzo]);

    assert.deepEqual(await esci(id, secondo, () => ADESSO + 10), { esito: 'uscito', promosso: null });

    const { postiOccupati, inAttesa } = (await attivita(id).get()).data();
    assert.equal(postiOccupati, 2);
    assert.equal(inAttesa, 1);
    assert.deepEqual(await iscrivi(id, terzo, () => ADESSO + 11), { esito: 'in_attesa', posizione: 1 });
  });

  it('chi rientra dopo essere uscito va in fondo alla coda', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    const [primo, secondo, terzo] = studenti(3);
    await iscriviInSequenza(id, [primo, secondo, terzo]);

    await esci(id, secondo, () => ADESSO + 10);
    assert.deepEqual(await iscrivi(id, secondo, () => ADESSO + 11), { esito: 'in_attesa', posizione: 2 });
  });

  it('di chi non è iscritto, o è già uscito, non cambia niente', async () => {
    id = await attivitaDiProva();
    await iscrivi(id, 'michele', () => ADESSO);
    await esci(id, 'michele', () => ADESSO + 1);

    assert.deepEqual(await esci(id, 'michele', () => ADESSO + 2), { esito: 'non_iscritto' });
    assert.deepEqual(await esci(id, 'nessuno', () => ADESSO + 3), { esito: 'non_iscritto' });
    assert.deepEqual(await esci('inesistente', 'michele', () => ADESSO), { esito: 'non_iscritto' });
    assert.deepEqual(await eventiDi(id, 'uscito'), ['michele']);
  });

  it("con un id malformato non trova nessuna iscrizione", async () => {
    id = undefined;
    for (const malformato of ID_MALFORMATI) {
      assert.deepEqual(await esci(malformato, 'michele', () => ADESSO), { esito: 'non_iscritto' });
    }
  });

  it("è rifiutata all'organizzatore", async () => {
    id = await attivitaDiProva({}, 'manuela');
    assert.deepEqual(await esci(id, 'manuela', () => ADESSO), {
      esito: 'rifiutato',
      motivo: 'organizzatore',
    });
  });

  it("è rifiutata se l'attività è già iniziata", async () => {
    id = await attivitaDiProva();
    await iscrivi(id, 'michele', () => ADESSO);
    assert.deepEqual(await esci(id, 'michele', () => DOMANI), { esito: 'rifiutato', motivo: 'iniziata' });
  });
});

// Lo stato da_confermare lo produrrà la modifica sostanziale
async function daRiconfermare(id, uid, entro) {
  const batch = db.batch();
  batch.update(attivita(id).collection('partecipanti').doc(uid), { stato: 'da_confermare', confermaEntro: entro });
  batch.update(attivita(id), { daConfermare: 1 });
  await batch.commit();
}

describe('campi di M4', () => {
  it('confermatoIl segna la conferma, anche per promozione', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    const [primo, secondo] = studenti(2);
    await iscriviInSequenza(id, [primo, secondo]);
    assert.equal((await partecipante(id, primo)).confermatoIl, ADESSO);
    assert.equal((await partecipante(id, secondo)).confermatoIl, null);

    await esci(id, primo, () => ADESSO + 10);
    const promosso = await partecipante(id, secondo);
    assert.equal(promosso.stato, 'confermato');
    assert.equal(promosso.confermatoIl, ADESSO + 10);
  });

  it('chi deve riconfermare riceve da_confermare con la scadenza', async () => {
    id = await attivitaDiProva();
    await iscrivi(id, 'michele', () => ADESSO);
    await daRiconfermare(id, 'michele', DOMANI);
    assert.deepEqual(await iscrivi(id, 'michele', () => ADESSO + 1), { esito: 'da_confermare', entro: DOMANI });
  });

  it('se esce chi deve riconfermare, il suo posto va al primo in coda', async () => {
    id = await attivitaDiProva({ capacita: 2 });
    const [primo, secondo] = studenti(2);
    await iscriviInSequenza(id, [primo, secondo]);
    await daRiconfermare(id, primo, DOMANI);

    assert.deepEqual(await esci(id, primo, () => ADESSO + 10), { esito: 'uscito', promosso: secondo });
    assert.equal((await attivita(id).get()).data().daConfermare, 0);
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

  it(`uscita e iscrizione simultanee sull'ultimo posto, ${GIRI} giri: il posto resta occupato`, async () => {
    for (let giro = 1; giro <= GIRI; giro++) {
      id = await attivitaDiProva({ capacita: 2 });
      await iscrivi(id, 'michele', orologio);

      // In qualunque ordine vadano, lo stato finale è uno solo.
      await Promise.all([esci(id, 'michele', orologio), iscrivi(id, 'nicola', orologio)]);

      const { postiOccupati, inAttesa, stato } = (await attivita(id).get()).data();
      assert.equal(postiOccupati, 2, `giro ${giro}`);
      assert.equal(inAttesa, 0, `giro ${giro}`);
      assert.equal(stato, 'completa', `giro ${giro}`);
      assert.equal((await partecipante(id, 'nicola')).stato, 'confermato', `giro ${giro}`);
      await verificaInvarianti(id);
    }
  });
});

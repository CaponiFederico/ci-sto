import { svuotaFirestore } from './emulatore.mjs';

import assert from 'node:assert/strict';
import { after, beforeEach, describe, it } from 'node:test';

import { creaAttivita, validaNuovaAttivita } from '../apps/api/dist/attivita.js';
import { db } from '../apps/api/dist/firestore.js';

const ADESSO = Date.UTC(2026, 9, 1, 12, 0);
const DOMANI = ADESSO + 24 * 60 * 60 * 1000;

const valida = {
  titolo: 'Calcetto',
  descrizione: 'Cerco otto persone',
  categoria: 'sport',
  inizio: DOMANI,
  durataMinuti: 90,
  luogo: { testo: 'Campo CUS', lat: 43.7169, lon: 10.3917 },
  capacita: 8,
  politicaCoda: 'fifo',
};

function errori(dati) {
  const esito = validaNuovaAttivita(dati, ADESSO);
  assert.equal(esito.ok, false);
  return esito.errori;
}

beforeEach(svuotaFirestore);
after(() => db.terminate());

describe('validazione', () => {
  it('accetta un attività completa', () => {
    assert.equal(validaNuovaAttivita(valida, ADESSO).ok, true);
  });

  it('usa fifo se la politica manca', () => {
    const { politicaCoda, ...senza } = valida;
    assert.equal(validaNuovaAttivita(senza, ADESSO).valore.politicaCoda, 'fifo');
  });

  it('rifiuta la capacità fuori dai limiti', () => {
    assert.deepEqual(errori({ ...valida, capacita: 1 }), ['capacita']);
    assert.deepEqual(errori({ ...valida, capacita: 101 }), ['capacita']);
    assert.deepEqual(errori({ ...valida, capacita: 7.5 }), ['capacita']);
  });

  it('rifiuta un inizio nel passato', () => {
    assert.deepEqual(errori({ ...valida, inizio: ADESSO - 1 }), ['inizio']);
  });

  it('rifiuta categoria e politica sconosciute', () => {
    assert.deepEqual(errori({ ...valida, categoria: 'rave', politicaCoda: 'amici' }), [
      'categoria',
      'politicaCoda',
    ]);
  });

  it('rifiuta una sola coordinata', () => {
    assert.deepEqual(errori({ ...valida, luogo: { testo: 'CUS', lat: 43.7 } }), ['luogo']);
  });

  it('accetta un luogo senza coordinate', () => {
    assert.equal(validaNuovaAttivita({ ...valida, luogo: { testo: 'aula B12' } }, ADESSO).ok, true);
  });

  it('scarta i campi che il client non deve decidere', () => {
    const esito = validaNuovaAttivita({ ...valida, postiOccupati: 5, organizzatore: 'altro' }, ADESSO);
    assert.equal('postiOccupati' in esito.valore, false);
    assert.equal('organizzatore' in esito.valore, false);
  });
});

describe('creazione', () => {
  it('scrive l attività con i campi che decide il server', async () => {
    const { valore } = validaNuovaAttivita({ ...valida, postiOccupati: 5 }, ADESSO);
    const id = await creaAttivita('manuela', valore, ADESSO);

    const attivita = (await db.collection('attivita').doc(id).get()).data();
    assert.equal(attivita.organizzatore, 'manuela');
    assert.equal(attivita.postiOccupati, 0);
    assert.equal(attivita.stato, 'aperta');
    assert.equal(attivita.versione, 1);
    assert.equal(attivita.creataIl, ADESSO);
  });

  it('registra la creazione nel diario, nella stessa scrittura', async () => {
    const { valore } = validaNuovaAttivita(valida, ADESSO);
    const id = await creaAttivita('manuela', valore, ADESSO);

    const eventi = await db.collection('attivita').doc(id).collection('eventi').get();
    assert.equal(eventi.size, 1);
    assert.deepEqual(eventi.docs[0].data(), {
      tipo: 'creata',
      utente: 'manuela',
      quando: ADESSO,
      versione: 1,
    });
  });
});

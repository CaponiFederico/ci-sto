import { ErroreApi } from './api';
import { iscrivi, lascia, riconferma } from './azioni';
import { metti, togli, tutte, type Rifiuto, type Sospesa } from './sospese';
import { avvisoIscrizione, avvisoRiconferma, avvisoUscita, CAMBIATA_IN_SOSPESO } from './testi';

const rifiuto = (testo: string | null): Rifiuto | null => (testo === null ? null : { testo, cambiata: false });

// Invia una richiesta e dice com'è andata
// null se è riuscita, altrimenti il rifiuto del server
async function manda(s: Sospesa): Promise<Rifiuto | null> {
  switch (s.azione) {
    case 'iscrivi': {
      const esito = await iscrivi(s.idAttivita, s.versioneVista);
      if (esito.esito === 'rifiutato' && esito.motivo === 'attivita_cambiata') {
        return { testo: CAMBIATA_IN_SOSPESO, cambiata: true };
      }
      return rifiuto(avvisoIscrizione(esito));
    }
    case 'lascia':
      return rifiuto(avvisoUscita(await lascia(s.idAttivita)));
    case 'riconferma':
      return rifiuto(avvisoRiconferma(await riconferma(s.idAttivita)));
  }
}

// Avvio e ritorno della rete possono chiamarla 
let inCorso = false;

// Svuota la coda dell'utente
export async function inviaSospese(uid: string) {
  if (inCorso) return;
  inCorso = true;

  try {
    for (const sospesa of await tutte(uid)) {
      // Già arbitrata dal server: aspetta solo di essere letta.
      if (sospesa.rifiuto) continue;

      try {
        const esito = await manda(sospesa);
        // Riuscita: sparisce e lo stato arriva da Firestore
        // Rifiutata: resta con il motivo.
        if (esito === null) await togli(sospesa.idAttivita);
        else await metti({ ...sospesa, rifiuto: esito });
      } catch (e) {
        // Ancora senza rete
        if (e instanceof ErroreApi && e.codice === 'api_irraggiungibile') return;
        await metti({ ...sospesa, rifiuto: { testo: 'Non è stato possibile inviare la richiesta.', cambiata: false } });
      }
    }
  } finally {
    inCorso = false;
  }
}

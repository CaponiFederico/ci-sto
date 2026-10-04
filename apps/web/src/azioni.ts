import type {
  EsitoAnnullamento,
  EsitoIscrizione,
  EsitoModifica,
  EsitoRicerca,
  EsitoRiconferma,
  EsitoUscita,
  NuovaAttivita,
  StatoIscrizione,
} from 'modello';
import { chiamaApi } from './api';

// La ricerca passa dall'APi
export function cercaLuoghi(q: string) {
  return chiamaApi<EsitoRicerca>(`/v1/luoghi?q=${encodeURIComponent(q)}`);
}

// Ogni scrittura passa dall'API
export function creaAttivita(nuova: NuovaAttivita) {
  return chiamaApi<{ id: string }>('/v1/attivita', { method: 'POST', body: JSON.stringify(nuova) });
}

// versioneVista: la versione dell'attività che la persona aveva davanti quando ha chiesto di iscriversi
export function iscrivi(id: string, versioneVista: number) {
  return chiamaApi<EsitoIscrizione>(`/v1/attivita/${id}/iscrizione`, {
    method: 'POST',
    body: JSON.stringify({ versioneVista }),
  });
}

export function lascia(id: string) {
  return chiamaApi<EsitoUscita>(`/v1/attivita/${id}/iscrizione`, { method: 'DELETE' });
}

// Lo stato di chi chiede: posizione e motivo li conosce solo l'API
export function statoIscrizione(id: string) {
  return chiamaApi<StatoIscrizione>(`/v1/attivita/${id}/iscrizione`);
}

export function modifica(id: string, campi: Partial<NuovaAttivita>, forza: boolean) {
  return chiamaApi<EsitoModifica>(`/v1/attivita/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ ...campi, forza }),
  });
}

export function riconferma(id: string) {
  return chiamaApi<EsitoRiconferma>(`/v1/attivita/${id}/riconferma`, { method: 'POST' });
}

export function annulla(id: string) {
  return chiamaApi<EsitoAnnullamento>(`/v1/attivita/${id}/annullamento`, { method: 'POST' });
}

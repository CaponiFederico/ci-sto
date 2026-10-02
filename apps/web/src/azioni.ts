import type { EsitoIscrizione, EsitoUscita, NuovaAttivita, StatoIscrizione } from 'modello';
import { chiamaApi } from './api';

// Ogni scrittura passa dall'API
export function creaAttivita(nuova: NuovaAttivita) {
  return chiamaApi<{ id: string }>('/v1/attivita', { method: 'POST', body: JSON.stringify(nuova) });
}

export function iscrivi(id: string) {
  return chiamaApi<EsitoIscrizione>(`/v1/attivita/${id}/iscrizione`, { method: 'POST' });
}

export function lascia(id: string) {
  return chiamaApi<EsitoUscita>(`/v1/attivita/${id}/iscrizione`, { method: 'DELETE' });
}

// Lo stato di chi chiede: posizione e motivo li conosce solo l'API
export function statoIscrizione(id: string) {
  return chiamaApi<StatoIscrizione>(`/v1/attivita/${id}/iscrizione`);
}

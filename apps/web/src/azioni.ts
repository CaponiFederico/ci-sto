import type {
  EsitoAnnullamento,
  EsitoIscrizione,
  EsitoModifica,
  EsitoRiconferma,
  EsitoUscita,
  NuovaAttivita,
  StatoIscrizione,
} from 'modello';
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

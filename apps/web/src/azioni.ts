import type { NuovaAttivita } from 'modello';
import { chiamaApi } from './api';

// Ogni scrittura passa dall'API
export function creaAttivita(nuova: NuovaAttivita) {
  return chiamaApi<{ id: string }>('/v1/attivita', { method: 'POST', body: JSON.stringify(nuova) });
}

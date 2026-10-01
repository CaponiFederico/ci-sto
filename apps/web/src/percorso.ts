import { useEffect, useState } from 'react';

export type Rotta =
  | { pagina: 'elenco' }
  | { pagina: 'nuova' }
  | { pagina: 'dettaglio'; id: string }
  | { pagina: 'modifica'; id: string }
  | { pagina: 'sconosciuta' };


const leggi = () => location.hash.slice(1) || '/';

export function usePercorso() {
  const [percorso, setPercorso] = useState(leggi);

  useEffect(() => {
    const aggiorna = () => setPercorso(leggi());
    window.addEventListener('hashchange', aggiorna);
    return () => window.removeEventListener('hashchange', aggiorna);
  }, []);

  return percorso;
}

export function rotta(percorso: string): Rotta {
  const [primo, id, azione, ...resto] = percorso.split('/').filter(Boolean);

  if (!primo) return { pagina: 'elenco' };
  if (primo === 'nuova' && !id) return { pagina: 'nuova' };
  if (primo === 'attivita' && id && resto.length === 0) {
    if (!azione) return { pagina: 'dettaglio', id };
    if (azione === 'modifica') return { pagina: 'modifica', id };
  }
  return { pagina: 'sconosciuta' };
}

import type { User } from 'firebase/auth';
import { createContext, use } from 'react';

// ContestoUtente è il contesto che contiene l'utente loggato
export const ContestoUtente = createContext<User | null>(null);

export function useUtente() {
  const utente = use(ContestoUtente);
  if (!utente) throw new Error('useUtente fuori da una sessione aperta');
  return utente;
}

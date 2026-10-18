// La preferenza vale su questo dispositivo
export type Tema = 'sistema' | 'chiaro' | 'scuro';

export const TEMI: Tema[] = ['sistema', 'chiaro', 'scuro'];

const RICORDO = 'bacheca:tema';

export function temaScelto(): Tema {
  const letto = localStorage.getItem(RICORDO);
  return letto === 'chiaro' || letto === 'scuro' ? letto : 'sistema';
}

export function scegliTema(tema: Tema) {
  if (tema === 'sistema') {
    localStorage.removeItem(RICORDO);
    delete document.documentElement.dataset.tema;
  } else {
    localStorage.setItem(RICORDO, tema);
    document.documentElement.dataset.tema = tema;
  }
}

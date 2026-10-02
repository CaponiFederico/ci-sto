import { CATEGORIE, type Categoria, type NuovaAttivita, type PoliticaCoda } from 'modello';

const CAMPI = [
  'titolo',
  'descrizione',
  'categoria',
  'inizio',
  'durataMinuti',
  'luogo',
  'capacita',
  'politicaCoda',
] as const;

export type Campo = (typeof CAMPI)[number];

// I valori di un modulo di creazione o modifica di un evento
export type Valori = Record<Campo, string>;

export const VALORI_INIZIALI: Valori = {
  titolo: '',
  descrizione: '',
  categoria: CATEGORIE[0],
  inizio: '',
  durataMinuti: '60',
  luogo: '',
  capacita: '4',
  politicaCoda: 'fifo',
};

export function daModulo(dati: FormData) {
  return Object.fromEntries(CAMPI.map((c) => [c, String(dati.get(c) ?? '')])) as Valori;
}

// Un valore non valido lo rifiuta l'API
export function inAttivita(v: Valori): NuovaAttivita {
  return {
    titolo: v.titolo,
    descrizione: v.descrizione,
    categoria: v.categoria as Categoria,
    inizio: new Date(v.inizio).getTime(),
    durataMinuti: Number(v.durataMinuti),
    luogo: { testo: v.luogo },
    capacita: Number(v.capacita),
    politicaCoda: v.politicaCoda as PoliticaCoda,
  };
}

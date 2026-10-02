import { CATEGORIE, type Attivita, type Categoria, type NuovaAttivita, type PoliticaCoda } from 'modello';

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

function oraLocale(istante: number) {
  const d = new Date(istante);
  const due = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${due(d.getMonth() + 1)}-${due(d.getDate())}T${due(d.getHours())}:${due(d.getMinutes())}`;
}

export function daAttivita(a: Attivita): Valori {
  return {
    titolo: a.titolo,
    descrizione: a.descrizione,
    categoria: a.categoria,
    inizio: oraLocale(a.inizio),
    durataMinuti: String(a.durataMinuti),
    luogo: a.luogo.testo,
    capacita: String(a.capacita),
    politicaCoda: a.politicaCoda,
  };
}

// Solo i campi toccati
export function cambiati(prima: Valori, dopo: Valori) {
  const tutti = inAttivita(dopo);
  const toccati = CAMPI.filter((c) => prima[c] !== dopo[c]);
  return Object.fromEntries(toccati.map((c) => [c, tutti[c]])) as Partial<NuovaAttivita>;
}

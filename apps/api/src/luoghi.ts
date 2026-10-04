import type { EsitoRicerca, LuogoTrovato } from 'modello';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

// Nominatim richiede un User-Agent che identifichi l'applicazione e un indirizzo di contatto1
const USER_AGENT =
  process.env.NOMINATIM_USER_AGENT ?? 'bacheca-unipi/1.0 (+https://github.com/CaponiFederico/ci-sto)';

// L'area di Pisa
const PISA = '10.30,43.78,10.50,43.65';

// limite una richiesta al secondo 
const INTERVALLO = 1100;
const TETTO_CACHE = 500;
const CODA_MASSIMA = 5;
const TEMPO_MASSIMO = 5000;

interface Opzioni {
  chiama?: typeof fetch;
  orologio?: () => number;
  attendi?: (ms: number) => Promise<void>;
  intervallo?: number;
  tettoCache?: number;
}

// normlizzazione
function normalizza(q: string) {
  return q.trim().toLowerCase().replace(/\s+/g, ' ');
}

// solo voci valide
function leggi(dati: unknown): LuogoTrovato[] {
  if (!Array.isArray(dati)) return [];
  const luoghi: LuogoTrovato[] = [];
  for (const voce of dati as Record<string, unknown>[]) {
    const lat = Number(voce?.lat);
    const lon = Number(voce?.lon);
    if (typeof voce?.display_name !== 'string' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    luoghi.push({ nome: voce.display_name.slice(0, 300), lat, lon });
  }
  return luoghi;
}

// cache
export function creaRicerca({
  chiama = fetch,
  orologio = Date.now,
  attendi = (ms) => new Promise((fatto) => setTimeout(fatto, ms)),
  intervallo = INTERVALLO,
  tettoCache = TETTO_CACHE,
}: Opzioni = {}) {
  const cache = new Map<string, LuogoTrovato[]>();
  let turno: Promise<unknown> = Promise.resolve();
  let inAttesa = 0;
  let ultima = -Infinity;

  async function chiedi(chiave: string): Promise<EsitoRicerca> {
    const pronti = cache.get(chiave);
    if (pronti) return { esito: 'trovati', luoghi: pronti };

    const attesa = ultima + intervallo - orologio();
    if (attesa > 0) await attendi(attesa);
    ultima = orologio();

    const parametri = new URLSearchParams({
      q: chiave,
      format: 'jsonv2',
      limit: '5',
      countrycodes: 'it',
      viewbox: PISA,
      'accept-language': 'it',
    });

    try {
      const risposta = await chiama(`${NOMINATIM}?${parametri}`, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(TEMPO_MASSIMO),
      });
      if (!risposta.ok) return { esito: 'non_disponibile' };

      const luoghi = leggi(await risposta.json());
      cache.set(chiave, luoghi);
      if (cache.size > tettoCache) cache.delete(cache.keys().next().value!);
      return { esito: 'trovati', luoghi };
    } catch {
      return { esito: 'non_disponibile' };
    }
  }

  return async function cerca(q: string): Promise<EsitoRicerca> {
    const chiave = normalizza(q);
    const pronti = cache.get(chiave);
    if (pronti) return { esito: 'trovati', luoghi: pronti };

    if (inAttesa >= CODA_MASSIMA) return { esito: 'non_disponibile' };

    inAttesa += 1;
    const mia = turno.then(() => chiedi(chiave)).finally(() => (inAttesa -= 1));
    turno = mia;
    return mia;
  };
}

export const cercaLuoghi = creaRicerca();

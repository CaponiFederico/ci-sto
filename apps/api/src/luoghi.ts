import type { EsitoRicerca, LuogoTrovato } from 'modello';

const NOMINATIM = 'https://nominatim.openstreetmap.org';

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
const cache = new Map<string, LuogoTrovato[]>();
let turno: Promise<unknown> = Promise.resolve();
let inAttesa = 0;
let ultima = -Infinity;

async function chiedi(chiave: string, indirizzo: string, estrai: (dati: unknown) => LuogoTrovato[]): Promise<EsitoRicerca> {
  const pronti = cache.get(chiave);
  if (pronti) return { esito: 'trovati', luoghi: pronti };

  const attesa = ultima + INTERVALLO - Date.now();
  if (attesa > 0) await new Promise((fatto) => setTimeout(fatto, attesa));
  ultima = Date.now();

  try {
    const risposta = await fetch(indirizzo, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TEMPO_MASSIMO),
    });
    if (!risposta.ok) return { esito: 'non_disponibile' };

    const luoghi = estrai(await risposta.json());
    cache.set(chiave, luoghi);
    if (cache.size > TETTO_CACHE) cache.delete(cache.keys().next().value!);
    return { esito: 'trovati', luoghi };
  } catch {
    return { esito: 'non_disponibile' };
  }
}

// Ricerca e ricerca inversa passano dalla stessa coda
function inCoda(chiave: string, indirizzo: string, estrai: (dati: unknown) => LuogoTrovato[]): Promise<EsitoRicerca> {
  const pronti = cache.get(chiave);
  if (pronti) return Promise.resolve({ esito: 'trovati', luoghi: pronti });

  if (inAttesa >= CODA_MASSIMA) return Promise.resolve({ esito: 'non_disponibile' });

  inAttesa += 1;
  const mia = turno.then(() => chiedi(chiave, indirizzo, estrai)).finally(() => (inAttesa -= 1));
  turno = mia;
  return mia;
}

export function cercaLuoghi(q: string) {
  const chiave = normalizza(q);
  const parametri = new URLSearchParams({
    q: chiave,
    format: 'jsonv2',
    limit: '5',
    countrycodes: 'it',
    viewbox: PISA,
    'accept-language': 'it',
  });
  return inCoda(chiave, `${NOMINATIM}/search?${parametri}`, leggi);
}

export function indirizzoDi(lat: number, lon: number) {
  const punto = { lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) };
  const parametri = new URLSearchParams({
    lat: String(punto.lat),
    lon: String(punto.lon),
    format: 'jsonv2',
    'accept-language': 'it',
  });
  const estrai = (dati: unknown) => leggi([dati]).map((trovato) => ({ ...trovato, ...punto }));
  return inCoda(`inverso:${punto.lat},${punto.lon}`, `${NOMINATIM}/reverse?${parametri}`, estrai);
}

import { useOnline } from '../rete';
import { MAPPA } from '../testi';

interface Proprieta {
  nome: string;
  lat: number;
  lon: number;
}

// pagina openstreetmap.org incorporata
function riquadro(lat: number, lon: number) {
  const d = 0.004;
  const bordi = [lon - d, lat - d, lon + d, lat + d].join(',');
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bordi}&layer=mapnik&marker=${lat},${lon}`;
}

export function Mappa({ nome, lat, lon }: Proprieta) {
  const online = useOnline();
  if (!online) return null;

  return (
    <>
      <iframe className="anteprima" title={`Mappa: ${nome}`} src={riquadro(lat, lon)} loading="lazy" />
      <p className="nota">{MAPPA.indicativa}</p>
    </>
  );
}

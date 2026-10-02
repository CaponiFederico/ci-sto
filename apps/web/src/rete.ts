import { useEffect, useState } from 'react';

// Hook per sapere se il browser è online o offline
// Serve per mostrare un messaggio di avviso quando si perde la connessione
export function useOnline() {
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const tornata = () => setOnline(true);
    const caduta = () => setOnline(false);
    window.addEventListener('online', tornata);
    window.addEventListener('offline', caduta);
    return () => {
      window.removeEventListener('online', tornata);
      window.removeEventListener('offline', caduta);
    };
  }, []);

  return online;
}

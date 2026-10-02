import { Suspense, use } from 'react';
import { leggiNome } from '../dati';

// use sospende il componente finché la promise non si risolve
function NomeLetto({ uid }: { uid: string }) {
  return use(leggiNome(uid));
}

// Il componente Nome sospende il rendering finché il nome non è disponibile
export function Nome({ uid }: { uid: string }) {
  return (
    <Suspense fallback="…">
      <NomeLetto uid={uid} />
    </Suspense>
  );
}

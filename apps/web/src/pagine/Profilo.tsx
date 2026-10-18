import { useState } from 'react';
import { MiaPosizione } from '../componenti/MiaPosizione';
import { Nome } from '../componenti/Nome';
import { Notifiche } from '../componenti/Notifiche';
import { useUtente } from '../sessione';
import { scegliTema, temaScelto, TEMI, type Tema } from '../tema';
import { TEMA } from '../testi';

export function Profilo() {
  const utente = useUtente();
  const [tema, setTema] = useState(temaScelto);

  function cambiaTema(scelto: Tema) {
    scegliTema(scelto);
    setTema(scelto);
  }

  return (
    <article className="profilo">
      <p className="ritorno">
        <a href="#/">← Bacheca</a>
      </p>

      <h2>Profilo</h2>

      <p>
        Sei dentro come <strong>{utente.email}</strong>. Gli altri ti vedono come{' '}
        <strong>
          <Nome uid={utente.uid} />
        </strong>
        .
      </p>
      <p className="nota">Le scelte qui sotto valgono solo su questo dispositivo.</p>

      <section>
        <h3>Posizione</h3>
        <MiaPosizione />
      </section>

      <section>
        <h3>Notifiche</h3>
        <Notifiche />
      </section>

      <section>
        <h3 id="titolo-tema">Tema</h3>
        <div className="scelte" role="radiogroup" aria-labelledby="titolo-tema">
          {TEMI.map((t) => (
            <label key={t} className="scelta">
              <input type="radio" name="tema" checked={tema === t} onChange={() => cambiaTema(t)} />
              {TEMA[t]}
            </label>
          ))}
        </div>
      </section>
    </article>
  );
}

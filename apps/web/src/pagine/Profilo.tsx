import { MiaPosizione } from '../componenti/MiaPosizione';
import { Nome } from '../componenti/Nome';
import { Notifiche } from '../componenti/Notifiche';
import { useUtente } from '../sessione';

export function Profilo() {
  const utente = useUtente();

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

    </article>
  );
}

// Modulo per creare o modificare un'attività. Non fa niente: il modulo vero è in ModuloForm
export function Modulo({ id }: { id?: string }) {
  return (
    <> 
      <div className="barra">
        <h2>{id ? 'Modifica attività' : 'Nuova attività'}</h2>
        <a href={id ? `#/attivita/${id}` : '#/'}>Annulla</a>
      </div>
      <p className="vuoto">Modulo da compilare.</p>
    </>
  );
}

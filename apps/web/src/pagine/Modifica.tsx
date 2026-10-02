export function Modifica({ id }: { id: string }) {
  return (
    <>
      <div className="barra">
        <h2>Modifica attività</h2>
        <a href={`#/attivita/${id}`}>Annulla</a>
      </div>

      <p className="vuoto">Modulo da compilare.</p>
    </>
  );
}

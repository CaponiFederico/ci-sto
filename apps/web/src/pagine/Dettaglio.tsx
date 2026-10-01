export function Dettaglio({ id }: { id: string }) {
  return (
    <>
      <div className="barra">
        <h2>Attività</h2>
        <a href={`#/attivita/${id}/modifica`}>Modifica</a>
      </div>

      <p className="vuoto">Attività {id}</p>
    </>
  );
}

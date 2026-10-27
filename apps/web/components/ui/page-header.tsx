/**
 * Testata di pagina del mockup: eyebrow + titolo a sinistra; a destra un paragrafo
 * (`descrizione`) oppure un blocco libero (`destra`, per esempio i filtri a chip).
 */
export function PageHeader({
  numero,
  sezione,
  titolo,
  descrizione,
  destra,
  azione,
}: {
  numero?: string;
  sezione: string;
  titolo: string;
  descrizione?: string;
  destra?: React.ReactNode;
  azione?: React.ReactNode;
}) {
  const titoloEl = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <span className="eb">
        {numero ? `${numero} — ` : ""}
        {sezione}
      </span>
      <h1
        className="d num"
        style={{
          margin: 0,
          fontWeight: 500,
          fontSize: "clamp(2.4rem, 4.4vw, 3.8rem)",
          lineHeight: 1.04,
          letterSpacing: "-.032em",
        }}
      >
        {titolo}
      </h1>
    </div>
  );
  if (destra) {
    return (
      <section
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 24,
          alignItems: "flex-end",
          justifyContent: "space-between",
        }}
      >
        {titoloEl}
        {destra}
      </section>
    );
  }
  return (
    <section
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        gap: 24,
        alignItems: "end",
      }}
    >
      {titoloEl}
      {(descrizione || azione) && (
        <div
          style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 16 }}
        >
          {descrizione && (
            <p
              style={{
                margin: 0,
                maxWidth: "46ch",
                fontSize: 16,
                lineHeight: 1.7,
                color: "#3a372f",
              }}
            >
              {descrizione}
            </p>
          )}
          {azione}
        </div>
      )}
    </section>
  );
}

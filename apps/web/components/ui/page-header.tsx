/**
 * Testata di pagina: titolo e descrizione a sinistra, azioni a destra.
 * `numero`, `sezione`, `azione` e `destra` sono accettati per le pagine non ancora migrate.
 */
export function PageHeader({
  titolo,
  descrizione,
  azioni,
  stato,
  azione,
  destra,
}: {
  titolo: string;
  descrizione?: string;
  azioni?: React.ReactNode;
  /** etichetta accanto al titolo (per esempio lo stato di un documento) */
  stato?: React.ReactNode;
  numero?: string;
  sezione?: string;
  azione?: React.ReactNode;
  destra?: React.ReactNode;
}) {
  const laterale = azioni ?? azione ?? destra;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{titolo}</h1>
          {stato}
        </div>
        {descrizione && <p className="mt-1 max-w-2xl text-sm text-fg-2">{descrizione}</p>}
      </div>
      {laterale && <div className="flex flex-wrap items-center gap-2">{laterale}</div>}
    </div>
  );
}

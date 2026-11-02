/**
 * Testata di pagina: titolo e descrizione a sinistra, azioni a destra. Su telefono è compatta
 * (il titolo c'è già nella barra in alto) e le azioni stanno su una riga scorrevole.
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
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 max-md:gap-y-2">
      <div className="min-w-0 max-md:w-full">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-semibold tracking-tight text-fg max-md:text-xl">{titolo}</h1>
          {stato}
        </div>
        {descrizione && (
          <p className="mt-1 max-w-2xl text-sm text-fg-2 max-md:line-clamp-2 max-md:text-[13px] max-md:leading-snug">
            {descrizione}
          </p>
        )}
      </div>
      {laterale && (
        <div className="no-scrollbar flex flex-wrap items-center gap-2 max-md:-mx-4 max-md:w-[calc(100%+2rem)] max-md:flex-nowrap max-md:overflow-x-auto max-md:px-4 max-md:[&>*]:shrink-0">
          {laterale}
        </div>
      )}
    </div>
  );
}

export function PageHeader({
  numero,
  sezione,
  titolo,
  descrizione,
  azione,
}: {
  numero?: string;
  sezione: string;
  titolo: string;
  descrizione?: string;
  azione?: React.ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="eyebrow">
          {numero ? `${numero} — ` : ""}
          {sezione}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight sm:text-5xl">{titolo}</h1>
        {descrizione && <p className="mt-2 max-w-2xl text-muted">{descrizione}</p>}
      </div>
      {azione}
    </header>
  );
}

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
    <section className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-end gap-6">
      <div className="flex flex-col gap-3.5">
        <p className="eyebrow">
          {numero ? `${numero} — ` : ""}
          {sezione}
        </p>
        <h1 className="font-display text-[clamp(2.4rem,4.4vw,3.8rem)] leading-[1.04] font-medium tracking-[-0.032em]">
          {titolo}
        </h1>
      </div>
      {(descrizione || azione) && (
        <div className="flex flex-col items-start gap-4">
          {descrizione && (
            <p className="max-w-[46ch] text-base leading-[1.7] text-ink-2">{descrizione}</p>
          )}
          {azione}
        </div>
      )}
    </section>
  );
}

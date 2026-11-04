export default function Caricamento() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Caricamento in corso…</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-subtle" />
      <div className="h-8 w-72 animate-pulse rounded-md bg-subtle" />
      <div className="flex gap-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-72 w-[272px] shrink-0 animate-pulse rounded-lg bg-subtle md:flex-1"
          />
        ))}
      </div>
    </div>
  );
}

export default function Caricamento() {
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-4">
      <span className="sr-only">Caricamento in corso…</span>
      <div className="h-8 w-48 animate-pulse rounded-md bg-subtle" />
      <div className="h-20 animate-pulse rounded-lg bg-subtle" />
      <div className="h-72 animate-pulse rounded-lg bg-subtle" />
    </div>
  );
}

import { cn } from "@/lib/utils";

/**
 * Iniziale colorata davanti al nome di un record, come i chip di Twenty.
 * Il colore deriva dal testo, così lo stesso record ha sempre la stessa
 * tinta senza doverla salvare a database.
 */
const COLORI = [
  "#4f9cf9", "#c084fc", "#f59e0b", "#34d399",
  "#fb7185", "#22d3ee", "#f472b6", "#a3e635",
];

export function coloreDa(testo: string) {
  let h = 0;
  for (let i = 0; i < testo.length; i++) h = (h * 31 + testo.charCodeAt(i)) >>> 0;
  return COLORI[h % COLORI.length];
}

export function Chip({
  testo,
  className,
}: {
  testo: string;
  className?: string;
}) {
  const colore = coloreDa(testo);
  const iniziale = testo.trim()[0]?.toUpperCase() ?? "?";
  return (
    <span
      className={cn(
        "grid h-[18px] w-[18px] flex-none place-items-center rounded text-xs font-semibold",
        className,
      )}
      style={{ background: `${colore}26`, color: colore }}
      aria-hidden
    >
      {iniziale}
    </span>
  );
}

/** Chip + etichetta, la combinazione usata nelle righe di tabella. */
export function ChipTesto({
  testo,
  className,
}: {
  testo: string;
  className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 items-center gap-1.5", className)}>
      <Chip testo={testo} />
      <span className="truncate">{testo}</span>
    </span>
  );
}

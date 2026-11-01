import { formatEuro, prezzoVisualizzato, type RegoleFiscali } from "@telaio/core";
import { cn } from "@/lib/utils";

/** Ogni prezzo si mostra netto e con IVA; senza IVA un solo prezzo con la dicitura. */
export function Prezzo({
  nettoCent,
  regole,
  className,
  suffisso,
}: {
  nettoCent: number;
  regole: RegoleFiscali;
  className?: string;
  suffisso?: string;
}) {
  if (nettoCent === 0) return <span className="text-fg-2">—</span>;
  const p = prezzoVisualizzato(nettoCent, regole);
  return (
    <span className={cn("inline-flex flex-col leading-tight tabular-nums", className)}>
      <span className="tabular-nums font-semibold">
        {formatEuro(p.nettoCent)}
        {suffisso}
        {p.lordoCent !== null && <span className="ml-1 text-xs font-normal text-fg-2">netto</span>}
      </span>
      {p.lordoCent !== null ? (
        <span className="text-xs text-fg-2">{formatEuro(p.lordoCent)} con IVA</span>
      ) : (
        p.dicitura && <span className="text-xs text-fg-2">{p.dicitura}</span>
      )}
    </span>
  );
}

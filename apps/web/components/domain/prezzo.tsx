import { type RegoleFiscali, formatEuro, prezzoVisualizzato } from "@telaio/core";
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
  const p = prezzoVisualizzato(nettoCent, regole);
  return (
    <span className={cn("inline-flex flex-col leading-tight tabular-nums", className)}>
      <span className="money font-semibold">
        {formatEuro(p.nettoCent)}
        {suffisso}
        {p.lordoCent !== null && <span className="ml-1 text-xs font-normal text-muted">netto</span>}
      </span>
      {p.lordoCent !== null ? (
        <span className="text-xs text-muted">
          {formatEuro(p.lordoCent)} con IVA
        </span>
      ) : (
        p.dicitura && <span className="text-xs text-muted">{p.dicitura}</span>
      )}
    </span>
  );
}

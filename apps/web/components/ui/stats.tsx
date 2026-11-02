import Link from "next/link";
import { cn } from "@/lib/utils";

export interface DatoStat {
  etichetta: string;
  valore: React.ReactNode;
  /** riga sotto il valore */
  nota?: React.ReactNode;
  href?: string;
  /** colora la nota (per esempio una scadenza) */
  tono?: "bad" | "warn";
}

/**
 * Indicatori in un unico riquadro, divisi da un filo. I fili sono lo spazio tra le celle (`gap-px`
 * su sfondo `line`): restano uniformi qualunque sia il numero di colonne. Su telefono sono due per
 * riga e l'ultimo, se dispari, occupa tutta la riga.
 */
export function StatsRow({ dati, className }: { dati: DatoStat[]; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:[grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]",
        className,
      )}
    >
      {dati.map((d) => (
        <div
          key={d.etichetta}
          className="flex flex-col gap-1 bg-surface p-4 max-sm:p-3 max-sm:last:odd:col-span-2"
        >
          <span className="text-xs font-medium text-fg-2">{d.etichetta}</span>
          <span className="text-xl font-semibold tracking-tight text-fg tabular-nums">
            {d.valore}
          </span>
          {d.nota &&
            (d.href ? (
              <Link
                href={d.href}
                className={cn(
                  "text-xs underline-offset-2 hover:underline",
                  d.tono === "bad" ? "text-bad" : d.tono === "warn" ? "text-warn" : "text-fg-2",
                )}
              >
                {d.nota}
              </Link>
            ) : (
              <span className="text-xs text-fg-2 tabular-nums">{d.nota}</span>
            ))}
        </div>
      ))}
    </div>
  );
}

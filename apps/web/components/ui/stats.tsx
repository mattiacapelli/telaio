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

/** Indicatori in fila dentro un unico riquadro, divisi da un filo. */
export function StatsRow({ dati, className }: { dati: DatoStat[]; className?: string }) {
  return (
    <div
      className={cn("grid overflow-hidden rounded-lg border border-line bg-surface", className)}
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {dati.map((d, i) => (
        <div
          key={d.etichetta}
          className={cn(
            "flex flex-col gap-1 p-4",
            i > 0 && "border-l border-line max-sm:border-t max-sm:border-l-0",
          )}
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

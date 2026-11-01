import { cn } from "@/lib/utils";

/** Elenco etichetta → valore, con un filo tra le righe. */
export function DefList({
  voci,
  className,
}: {
  voci: { etichetta: string; valore: React.ReactNode; numerico?: boolean }[];
  className?: string;
}) {
  return (
    <dl className={cn("divide-y divide-line text-sm", className)}>
      {voci.map((v) => (
        <div key={v.etichetta} className="flex items-baseline justify-between gap-4 py-2">
          <dt className="text-fg-2">{v.etichetta}</dt>
          <dd className={cn("text-right font-medium text-fg", v.numerico && "tabular-nums")}>
            {v.valore}
          </dd>
        </div>
      ))}
    </dl>
  );
}

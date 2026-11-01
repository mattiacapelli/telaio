import { cn } from "@/lib/utils";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-[shimmer_1.4s_ease-in-out_infinite] rounded-md bg-hover", className)}
      {...props}
    />
  );
}

/** Segnaposto di una tabella mentre i dati caricano. */
export function TableSkeleton({ righe = 6, colonne = 5 }: { righe?: number; colonne?: number }) {
  return (
    <div role="status" aria-label="Caricamento" className="flex flex-col gap-2">
      {Array.from({ length: righe }, (_, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: colonne }, (_, c) => (
            <Skeleton key={c} className="h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

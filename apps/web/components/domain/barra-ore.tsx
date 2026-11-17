import { formattaOre, type SaldoCiclo } from "@telaio/core";
import { cn } from "@/lib/utils";

/** Avanzamento delle ore di un periodo: verde, poi giallo dall'80%, rosso oltre il monte. */
export function BarraOre({ saldo, className }: { saldo: SaldoCiclo; className?: string }) {
  const tono = saldo.percentuale > 100 ? "bg-bad" : saldo.percentuale >= 80 ? "bg-warn" : "bg-ok";
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-label="Ore usate nel periodo"
        aria-valuenow={Math.min(saldo.percentuale, 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-2 overflow-hidden rounded-full bg-line"
      >
        <div
          className={cn("h-full", tono)}
          style={{ width: `${Math.min(saldo.percentuale, 100)}%` }}
        />
      </div>
      <p className="flex flex-wrap justify-between gap-x-3 text-xs text-fg-2 tabular-nums">
        <span>
          {formattaOre(saldo.usati)} su {formattaOre(saldo.incluse)}
        </span>
        <span className={saldo.extra > 0 ? "font-medium text-bad" : undefined}>
          {saldo.extra > 0
            ? `${formattaOre(saldo.extra)} oltre il monte`
            : `${formattaOre(saldo.rimanenti)} rimanenti`}
        </span>
      </p>
    </div>
  );
}

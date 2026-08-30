import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function Stat({
  etichetta,
  valore,
  nota,
  unita,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  unita?: string;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted">{etichetta}</div>
      <div className="mt-1.5 text-lg font-semibold tracking-tight">
        {valore}
        {unita && (
          <span className="ml-1 text-sm font-normal text-muted">{unita}</span>
        )}
      </div>
      {nota && <div className="mt-1 text-xs text-faint">{nota}</div>}
    </Card>
  );
}

const TONI = {
  neutro: "border-border bg-surface2 text-muted",
  accento: "border-accent-line bg-accent-soft text-text",
  positivo: "border-border bg-surface2 text-pos",
  attenzione: "border-border2 bg-surface3 text-text",
} as const;

export function Vuoto({
  titolo,
  nota,
  azione,
}: {
  titolo: string;
  nota?: string;
  azione?: ReactNode;
}) {
  return (
    <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="text-sm font-semibold">{titolo}</div>
      {nota && <div className="max-w-md text-xs text-muted">{nota}</div>}
      {azione && <div className="mt-2">{azione}</div>}
    </Card>
  );
}

export function Barra({ valore, max }: { valore: number; max: number }) {
  const pct = max > 0 ? Math.min(100, (valore / max) * 100) : 0;
  const oltre = valore > max;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface3">
      <div
        className="h-full rounded-full"
        style={{
          width: `${pct}%`,
          background: oltre ? "var(--neg)" : "var(--accent)",
        }}
      />
    </div>
  );
}

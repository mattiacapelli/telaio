"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Esecuzione manuale delle attività ricorrenti, con esito. */
export function SchedulerPannello({
  configurato,
  intervallo,
  ultima,
}: {
  configurato: boolean;
  intervallo: number;
  ultima: string | null;
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function esegui() {
    setInCorso(true);
    setEsito(null);
    const r = await fetch("/api/scheduler", { method: "POST" }).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      setEsito("Esecuzione non riuscita");
      return;
    }
    const d = await r.json();
    if (!d.eseguito) {
      setEsito(d.motivo ?? "non eseguito");
      return;
    }
    const parti = [
      d.contrattiScaduti > 0 && `${d.contrattiScaduti} contratti scaduti`,
      d.contrattiRinnovati > 0 && `${d.contrattiRinnovati} rinnovati`,
      d.avvisiCreati > 0 && `${d.avvisiCreati} avvisi`,
      d.workflowEseguiti > 0 && `${d.workflowEseguiti} workflow`,
    ].filter(Boolean);
    setEsito(parti.length ? parti.join(" · ") : "nessuna azione necessaria");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 p-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded bg-surface2 px-2 py-1.5">
          <div className="text-xs text-faint">Stato</div>
          <div className="mt-0.5 text-md">
            {configurato ? `Attivo · ogni ${Math.round(intervallo / 60)} minuti` : "Non configurato"}
          </div>
        </div>
        <div className="rounded bg-surface2 px-2 py-1.5">
          <div className="text-xs text-faint">Ultima esecuzione</div>
          <div className="mt-0.5 text-md">
            {ultima ? new Date(ultima).toLocaleString("it-IT") : "mai"}
          </div>
        </div>
      </div>

      {!configurato && (
        <div className="rounded border border-border bg-surface2 px-2 py-1.5 text-md text-muted">
          Imposta <code className="text-text">SCHEDULER_TOKEN</code> in{" "}
          <code className="text-text">.env</code> perché le attività ricorrenti
          partano da sole nel container. Puoi comunque eseguirle a mano qui.
        </div>
      )}

      <div className="text-xs text-faint">
        Controlla le scadenze dei contratti, applica i rinnovi automatici, crea
        gli avvisi su monte ore e scadenze, ed esegue i workflow a tempo.
      </div>

      <div className="flex items-center gap-2">
        {esito && <span className="text-xs text-muted">{esito}</span>}
        <div className="flex-1" />
        <Button size="sm" variant="outline" onClick={esegui} disabled={inCorso}>
          <RefreshCw /> {inCorso ? "Eseguo…" : "Esegui adesso"}
        </Button>
      </div>
    </div>
  );
}

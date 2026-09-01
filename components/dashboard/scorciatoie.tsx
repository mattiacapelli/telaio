"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Play, Square, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Azioni rapide della dashboard: ciò che si fa più spesso all'inizio della
 * giornata, senza dover passare dalle singole pagine.
 */
export function Scorciatoie({
  timerAttivo,
  etichettaTimer,
}: {
  timerAttivo: boolean;
  etichettaTimer: string | null;
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);

  async function fermaTimer() {
    setInCorso(true);
    await fetch("/api/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "stop" }),
    }).catch(() => null);
    setInCorso(false);
    window.dispatchEvent(new Event("telaio:timer-cambiato"));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {timerAttivo ? (
        <Button size="sm" variant="outline" onClick={fermaTimer} disabled={inCorso}>
          <Square /> {inCorso ? "Fermo…" : `Ferma: ${etichettaTimer ?? "timer"}`}
        </Button>
      ) : (
        <Button size="sm" variant="outline" asChild>
          <Link href="/attivita"><Play /> Avvia il lavoro</Link>
        </Button>
      )}
      <Button size="sm" variant="outline" asChild>
        <Link href="/preventivi"><Plus /> Preventivo</Link>
      </Button>
      <Button size="sm" variant="outline" asChild>
        <Link href="/fatture"><Plus /> Fattura</Link>
      </Button>
      <Button size="sm" variant="ghost" asChild>
        <Link href="/ore">Timesheet <ArrowRight /></Link>
      </Button>
    </div>
  );
}

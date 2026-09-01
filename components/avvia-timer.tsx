"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AvviaTimer({
  attivitaId,
  ticketId,
  progettoId,
  etichetta,
}: {
  attivitaId?: string;
  ticketId?: string;
  progettoId?: string;
  etichetta: string;
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);

  async function avvia() {
    setInCorso(true);
    await fetch("/api/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        azione: "start",
        attivitaId,
        ticketId,
        progettoId,
        etichetta,
      }),
    });
    // La pillola del timer in topbar fa polling ogni 15s: senza questo
    // evento l'utente non la vedrebbe comparire finché non scade il poll.
    window.dispatchEvent(new Event("telaio:timer-cambiato"));
    router.refresh();
    setInCorso(false);
  }

  return (
    <button
      onClick={avvia}
      disabled={inCorso}
      className="flex-none h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-md text-muted transition-colors hover:border-accent hover:text-accent disabled:opacity-50"
    >
      Avvia
    </button>
  );
}

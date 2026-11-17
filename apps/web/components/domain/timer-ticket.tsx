"use client";

import { Play } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { avviaTimerAction } from "@/app/(app)/tempo/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Avvia il timer su questo ticket: il cliente è quello del progetto. */
export function AvviaTimerTicket({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const [inCorso, avvia] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={inCorso}
        onClick={() => {
          setErrore(null);
          const dati = new FormData();
          dati.set("ticketId", ticketId);
          avvia(async () => {
            const esito = await avviaTimerAction({ ok: false }, dati);
            if (!esito.ok) {
              setErrore(esito.message ?? "Timer non avviato");
              return;
            }
            toast("Timer avviato su questo ticket");
            router.refresh();
          });
        }}
      >
        <Play /> Avvia timer
      </Button>
      {errore && (
        <p role="alert" className="max-w-64 text-right text-xs text-bad">
          {errore}
        </p>
      )}
    </div>
  );
}

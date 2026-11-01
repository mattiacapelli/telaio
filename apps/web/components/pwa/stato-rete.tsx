"use client";

import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "@/components/ui/toast";

type Stato = "online" | "offline" | "ripristinato";

/**
 * Indicatore discreto di connessione. Da offline blocca anche l'invio dei moduli: nessuna
 * operazione parte senza che il server possa confermarla, e l'utente lo sa subito.
 */
export function StatoRete() {
  const [stato, setStato] = useState<Stato>("online");

  useEffect(() => {
    if (!navigator.onLine) setStato("offline");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const offline = () => {
      clearTimeout(timer);
      setStato("offline");
    };
    const online = () => {
      setStato("ripristinato");
      timer = setTimeout(() => setStato("online"), 2500);
    };
    const blocca = (e: Event) => {
      if (navigator.onLine) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      toast.errore(
        "Sei offline",
        "L'operazione non è stata eseguita: riprova quando la connessione torna.",
      );
    };
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    // In fase di cattura, prima dei gestori dell'applicazione.
    document.addEventListener("submit", blocca, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      document.removeEventListener("submit", blocca, true);
    };
  }, []);

  if (stato === "online") return null;
  const offline = stato === "offline";
  const Icona = offline ? WifiOff : Wifi;
  return (
    <div
      role="status"
      className="pointer-events-none fixed top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 z-[60] -translate-x-1/2 animate-[toast-in_180ms_ease-out]"
    >
      <span className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs text-fg-2 shadow-pop">
        <Icona className={offline ? "size-3.5 text-warn" : "size-3.5 text-ok"} />
        {offline ? "Offline: le modifiche non vengono salvate" : "Di nuovo online"}
      </span>
    </div>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { pulisciCache } from "@/lib/pwa";

const CONTROLLO_OGNI_MS = 60 * 60 * 1000;

/**
 * Registra il Service Worker (solo in produzione) e avvisa quando ce n'è uno nuovo.
 * L'aggiornamento non è mai silenzioso: parte solo dal pulsante e, se ci sono modifiche non salvate
 * in un modulo, chiede prima conferma.
 */
export function AggiornamentoPwa() {
  const pathname = usePathname();
  const [attesa, setAttesa] = useState<ServiceWorker | null>(null);
  const [nascosto, setNascosto] = useState(false);
  const [conferma, setConferma] = useState(false);
  const modificato = useRef(false);
  const richiesto = useRef(false);

  // Segnala le modifiche non salvate: un campo modificato dentro un modulo, fino all'invio o al cambio pagina.
  useEffect(() => {
    const segna = (e: Event) => {
      if ((e.target as HTMLElement | null)?.closest?.("form")) modificato.current = true;
    };
    const azzera = () => {
      modificato.current = false;
    };
    document.addEventListener("input", segna, true);
    document.addEventListener("submit", azzera, true);
    return () => {
      document.removeEventListener("input", segna, true);
      document.removeEventListener("submit", azzera, true);
    };
  }, []);
  useEffect(() => {
    modificato.current = false;
    setConferma(false);
  }, [pathname]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      // In sviluppo niente Service Worker: se ne esiste uno vecchio lo si toglie.
      navigator.serviceWorker.getRegistrations().then((rs) => {
        for (const r of rs) r.unregister();
      });
      pulisciCache();
      return;
    }
    let timer: ReturnType<typeof setInterval> | undefined;
    const alCambio = () => {
      if (richiesto.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", alCambio);

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        const nuovo = (w: ServiceWorker | null) => {
          if (w && navigator.serviceWorker.controller) setAttesa(w);
        };
        nuovo(reg.waiting);
        reg.addEventListener("updatefound", () => {
          const w = reg.installing;
          w?.addEventListener("statechange", () => {
            if (w.state === "installed") nuovo(w);
          });
        });
        timer = setInterval(() => reg.update().catch(() => {}), CONTROLLO_OGNI_MS);
        const alRitorno = () =>
          document.visibilityState === "visible" && reg.update().catch(() => {});
        document.addEventListener("visibilitychange", alRitorno);
      })
      .catch(() => {
        // La registrazione può fallire (HTTPS mancante, browser): l'app funziona comunque online.
      });
    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", alCambio);
      if (timer) clearInterval(timer);
    };
  }, []);

  if (!attesa || nascosto) return null;

  const aggiorna = () => {
    if (modificato.current && !conferma) {
      setConferma(true);
      return;
    }
    richiesto.current = true;
    attesa.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <div
      role="status"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))] z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-pop animate-[toast-in_180ms_ease-out]"
    >
      <p className="text-sm font-medium text-fg">È disponibile un aggiornamento di Telaio.</p>
      {conferma ? (
        <p className="text-sm text-warn">
          Hai modifiche non salvate in un modulo: se aggiorni ora si perdono. Salvale prima, oppure
          aggiorna comunque.
        </p>
      ) : (
        <p className="text-sm text-fg-2">
          Si applica quando vuoi: la pagina si ricarica e la sessione resta attiva.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => setNascosto(true)}>
          Più tardi
        </Button>
        <Button size="sm" variant={conferma ? "danger" : "primary"} onClick={aggiorna}>
          {conferma ? "Aggiorna comunque" : "Aggiorna"}
        </Button>
      </div>
    </div>
  );
}

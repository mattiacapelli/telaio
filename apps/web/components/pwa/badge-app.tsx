"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type ConBadge = Navigator & {
  setAppBadge?: (n?: number) => Promise<void>;
  clearAppBadge?: () => Promise<void>;
};

/** Mantiene sull'icona dell'app il numero di azioni in attesa di conferma. Non mostra nulla. */
export function BadgeApp({ conteggio }: { conteggio: number }) {
  const router = useRouter();

  useEffect(() => {
    const nav = navigator as ConBadge;
    if (!nav.setAppBadge) return; // non supportato: nessun errore
    if (conteggio > 0) nav.setAppBadge(conteggio).catch(() => {});
    else nav.clearAppBadge?.().catch(() => {});
  }, [conteggio]);

  // Il layout non si ricarica navigando: tornando sull'app dopo un po' si rilegge il conteggio.
  useEffect(() => {
    let nascostoDal = 0;
    const alCambio = () => {
      if (document.hidden) nascostoDal = Date.now();
      else if (nascostoDal && Date.now() - nascostoDal > 60_000) router.refresh();
    };
    document.addEventListener("visibilitychange", alCambio);
    return () => document.removeEventListener("visibilitychange", alCambio);
  }, [router]);

  return null;
}

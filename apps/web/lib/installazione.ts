"use client";

import { useSyncExternalStore } from "react";

/** Evento non standard (Chromium): permette di far comparire la richiesta di installazione quando serve. */
interface EventoInstallazione extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface Stato {
  evento: EventoInstallazione | null;
  /** già aperta come app (finestra standalone, o dalla schermata Home su iOS) */
  standalone: boolean;
  /** iPhone/iPad: l'installazione è manuale (Condividi → Aggiungi alla schermata Home) */
  ios: boolean;
}

const SERVER: Stato = { evento: null, standalone: false, ios: false };
let stato: Stato = SERVER;
const ascoltatori = new Set<() => void>();

function aggiorna(parziale: Partial<Stato>) {
  stato = { ...stato, ...parziale };
  for (const a of ascoltatori) a();
}

function eStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: window-controls-overlay)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function eIos() {
  const ua = navigator.userAgent;
  // Da iPadOS 13 l'iPad si presenta come un Mac: lo si riconosce dal touch.
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

let avviato = false;

/** Da chiamare una sola volta dal client: ascolta gli eventi di installazione del browser. */
export function avviaRilevamentoInstallazione() {
  if (avviato || typeof window === "undefined") return;
  avviato = true;
  aggiorna({ standalone: eStandalone(), ios: eIos() });
  window.addEventListener("beforeinstallprompt", (e) => {
    // Niente mini-barra automatica del browser: l'installazione parte solo dal menu account.
    e.preventDefault();
    aggiorna({ evento: e as EventoInstallazione });
  });
  window.addEventListener("appinstalled", () => aggiorna({ evento: null, standalone: true }));
  window.matchMedia("(display-mode: standalone)").addEventListener("change", () => {
    aggiorna({ standalone: eStandalone() });
  });
}

/** Mostra la richiesta di installazione del browser. Restituisce true se l'utente accetta. */
export async function installa(): Promise<boolean> {
  const evento = stato.evento;
  if (!evento) return false;
  // L'evento si usa una volta sola, accettato o no.
  aggiorna({ evento: null });
  await evento.prompt();
  return (await evento.userChoice).outcome === "accepted";
}

export function useInstallazione() {
  const s = useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb);
      return () => ascoltatori.delete(cb);
    },
    () => stato,
    () => SERVER,
  );
  return {
    /** il browser permette l'installazione con un clic */
    installabile: !s.standalone && s.evento !== null,
    /** iPhone/iPad non ancora installata: servono le istruzioni manuali */
    istruzioniIos: !s.standalone && s.ios,
    standalone: s.standalone,
  };
}

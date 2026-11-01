"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

type Esito = "ok" | "errore" | "info";
interface Notifica {
  id: number;
  titolo: string;
  descrizione?: string;
  esito: Esito;
}

let notifiche: Notifica[] = [];
let prossimoId = 1;
const ascoltatori = new Set<() => void>();
const emetti = () => {
  for (const a of ascoltatori) a();
};

/** Mostra una notifica per qualche secondo: `toast("Salvato")`, `toast.errore("Non riuscito")`. */
export function toast(
  titolo: string,
  opzioni: { descrizione?: string; esito?: Esito; durata?: number } = {},
) {
  const id = prossimoId++;
  notifiche = [
    ...notifiche,
    { id, titolo, descrizione: opzioni.descrizione, esito: opzioni.esito ?? "ok" },
  ];
  emetti();
  setTimeout(() => chiudi(id), opzioni.durata ?? 4000);
}
toast.errore = (titolo: string, descrizione?: string) =>
  toast(titolo, { descrizione, esito: "errore", durata: 6000 });
toast.info = (titolo: string, descrizione?: string) =>
  toast(titolo, { descrizione, esito: "info" });

function chiudi(id: number) {
  notifiche = notifiche.filter((n) => n.id !== id);
  emetti();
}

const ICONE = { ok: CheckCircle2, errore: AlertCircle, info: Info } as const;
const COLORI = { ok: "text-ok", errore: "text-bad", info: "text-brand" } as const;
const VUOTO: Notifica[] = [];

/** Da montare una volta nel layout radice. */
export function Toaster() {
  const lista = useSyncExternalStore(
    (cb) => {
      ascoltatori.add(cb);
      return () => ascoltatori.delete(cb);
    },
    () => notifiche,
    () => VUOTO,
  );
  return (
    <div className="pointer-events-none fixed right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2">
      {lista.map((n) => {
        const Icona = ICONE[n.esito];
        return (
          <div
            key={n.id}
            role={n.esito === "errore" ? "alert" : "status"}
            className="pointer-events-auto flex items-start gap-2.5 rounded-lg border border-line bg-surface p-3 shadow-pop animate-[toast-in_180ms_ease-out]"
          >
            <Icona aria-hidden className={cn("mt-0.5 size-4 shrink-0", COLORI[n.esito])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-fg">{n.titolo}</p>
              {n.descrizione && <p className="mt-0.5 text-sm text-fg-2">{n.descrizione}</p>}
            </div>
            <button
              type="button"
              aria-label="Chiudi notifica"
              onClick={() => chiudi(n.id)}
              className="-mt-0.5 -mr-1 grid size-6 cursor-pointer place-items-center rounded-sm text-fg-3 transition-colors duration-150 hover:bg-hover hover:text-fg"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

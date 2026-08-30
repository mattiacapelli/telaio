"use client";

import { useEffect, useState, type ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type Vista = "kanban" | "tabella";

/**
 * Selettore kanban/tabella.
 *
 * La preferenza è per pagina e vive in localStorage: chi lavora in tabella
 * sui preventivi non se la ritrova cambiata passando ai ticket. Il primo
 * render usa sempre il valore predefinito e la preferenza viene applicata
 * dopo il mount, per non far divergere HTML del server e del client.
 */
export function SelettoreVista({
  chiave,
  vista,
  setVista,
}: {
  chiave: string;
  vista: Vista;
  setVista: (v: Vista) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded border border-border2 bg-[var(--alpha-lighter)] p-0.5">
      {(
        [
          ["kanban", LayoutGrid, "Kanban"],
          ["tabella", List, "Tabella"],
        ] as const
      ).map(([v, Icona, label]) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            setVista(v);
            try {
              localStorage.setItem(`telaio-vista-${chiave}`, v);
            } catch {
              /* modalità privata: la scelta vale per la sessione */
            }
          }}
          title={label}
          aria-pressed={vista === v}
          className={cn(
            "flex h-6 items-center gap-1 rounded-[3px] px-2 text-xs transition-colors",
            vista === v
              ? "bg-surface text-text shadow-[var(--shadow)]"
              : "text-muted hover:text-text",
          )}
        >
          <Icona size={13} strokeWidth={1.6} />
          {label}
        </button>
      ))}
    </div>
  );
}

/** Legge la preferenza salvata dopo il mount. */
export function useVista(chiave: string, iniziale: Vista = "kanban") {
  const [vista, setVista] = useState<Vista>(iniziale);

  useEffect(() => {
    try {
      const salvata = localStorage.getItem(`telaio-vista-${chiave}`);
      if (salvata === "kanban" || salvata === "tabella") setVista(salvata);
    } catch {
      /* nessuna preferenza disponibile */
    }
  }, [chiave]);

  return [vista, setVista] as const;
}

/**
 * Definizione di colonna.
 *
 * Le celle sono già ReactNode, non funzioni: il server component che compone
 * la tabella non può passare callback a un client component, quindi le righe
 * arrivano pre-renderizzate.
 */
export type ColonnaTabella = {
  intestazione: string;
  /** Larghezza CSS della colonna nella griglia. */
  larghezza?: string;
  allinea?: "sinistra" | "destra";
  icona?: ReactNode;
};

/** Riga pronta da mostrare: celle già renderizzate lato server. */
export type RigaTabella = {
  id: string;
  href?: string;
  celle: ReactNode[];
};


/**
 * Tabella densa in stile Twenty: righe basse, bordi sottili, intestazioni
 * con icona. Condivisa da tutte le pagine che offrono la vista elenco.
 */
export function Tabella({
  righe,
  colonne,
}: {
  righe: RigaTabella[];
  colonne: ColonnaTabella[];
}) {
  const griglia = colonne
    .map((c) => c.larghezza ?? "minmax(0, 1fr)")
    .join(" ");

  return (
    <div className="overflow-x-auto rounded border border-border bg-surface">
      <div className="min-w-[720px]">
        <div
          className="grid gap-2 border-b border-border px-2 py-2 text-xs font-medium text-faint"
          style={{ gridTemplateColumns: griglia }}
        >
          {colonne.map((c) => (
            <span
              key={c.intestazione}
              className={cn(
                "flex items-center gap-1.5",
                c.allinea === "destra" && "justify-end",
              )}
            >
              {c.icona}
              {c.intestazione}
            </span>
          ))}
        </div>

        {righe.length === 0 ? (
          <div className="px-3 py-8 text-center text-md text-faint">
            Nessun elemento
          </div>
        ) : (
          righe.map((r) => {
            const contenuto = (
              <div
                className="grid items-center gap-2 border-b border-border px-2 py-1.5 text-md last:border-0 hover:bg-[var(--alpha-lighter)]"
                style={{ gridTemplateColumns: griglia }}
              >
                {colonne.map((c, i) => (
                  <div
                    key={c.intestazione}
                    className={cn(
                      "min-w-0",
                      c.allinea === "destra" && "text-right",
                    )}
                  >
                    {r.celle[i]}
                  </div>
                ))}
              </div>
            );
            return r.href ? (
              <a key={r.id} href={r.href} className="block">
                {contenuto}
              </a>
            ) : (
              <div key={r.id}>{contenuto}</div>
            );
          })
        )}
      </div>
    </div>
  );
}

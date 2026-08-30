"use client";

import { useState, type ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Colonna sinistra della scheda di un record, nello stile di Twenty:
 * campi raggruppati in sezioni collassabili, coppie etichetta/valore con
 * l'icona del campo a sinistra.
 */
export function SezioneCampi({
  titolo,
  children,
  apertaDiDefault = true,
}: {
  titolo: string;
  children: ReactNode;
  apertaDiDefault?: boolean;
}) {
  const [aperta, setAperta] = useState(apertaDiDefault);

  return (
    <div className="border-b border-border last:border-0">
      <button
        onClick={() => setAperta((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-md font-medium text-muted transition-colors hover:text-text"
      >
        <span className="flex-1 text-left">{titolo}</span>
        <ChevronUp size={13} className={cn("transition-transform", !aperta && "rotate-180")} />
      </button>
      {aperta && <div className="flex flex-col gap-0.5 pb-2">{children}</div>}
    </div>
  );
}

/**
 * Riga etichetta → valore.
 *
 * Un valore assente resta visibile in grigio col nome del campo, come fa
 * Twenty: si vede cosa manca senza lasciare righe vuote.
 */
export function CampoRecord({
  icona,
  etichetta,
  children,
  vuoto,
}: {
  icona: ReactNode;
  etichetta: string;
  children?: ReactNode;
  vuoto?: string;
}) {
  const haValore =
    children !== null && children !== undefined && children !== "" && children !== false;
  return (
    <div className="flex items-center gap-2 px-3 py-1">
      <span className="flex w-[118px] flex-none items-center gap-1.5 text-md text-muted">
        <span className="text-faint">{icona}</span>
        <span className="truncate">{etichetta}</span>
      </span>
      <span className={cn("min-w-0 flex-1 truncate text-md", !haValore && "text-faint")}>
        {haValore ? children : (vuoto ?? etichetta)}
      </span>
    </div>
  );
}

/** Schede dell'area destra. */
export function Schede({
  schede,
}: {
  schede: {
    chiave: string;
    etichetta: string;
    icona: ReactNode;
    contenuto: ReactNode;
    conteggio?: number;
  }[];
}) {
  const [attiva, setAttiva] = useState(schede[0]?.chiave ?? "");
  const corrente = schede.find((s) => s.chiave === attiva) ?? schede[0];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-none items-center gap-1 overflow-x-auto border-b border-border px-2">
        {schede.map((s) => (
          <button
            key={s.chiave}
            onClick={() => setAttiva(s.chiave)}
            className={cn(
              "flex flex-none items-center gap-1.5 border-b-2 px-2 py-2 text-md transition-colors",
              attiva === s.chiave
                ? "border-text text-text"
                : "border-transparent text-muted hover:text-text",
            )}
          >
            {s.icona}
            {s.etichetta}
            {s.conteggio !== undefined && s.conteggio > 0 && (
              <span className="rounded bg-surface2 px-1 text-xs text-faint">
                {s.conteggio}
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">{corrente?.contenuto}</div>
    </div>
  );
}

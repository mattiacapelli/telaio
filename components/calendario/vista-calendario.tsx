"use client";

import { useEffect, useState } from "react";
import { CalendarDays, GanttChartSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EventoCalendario } from "@/lib/queries";
import { CalendarioMese } from "./calendario-mese";
import { GanttRighe } from "./gantt-righe";

type Modalita = "calendario" | "gantt";
const CHIAVE = "telaio-vista-calendario";

export function VistaCalendario({
  eventi,
  eventiRange,
  inizioMese,
  inizioRange,
  numeroGiorniRange,
}: {
  eventi: EventoCalendario[];
  eventiRange: EventoCalendario[];
  inizioMese: string;
  inizioRange: string;
  numeroGiorniRange: number;
}) {
  const [modalita, setModalita] = useState<Modalita>("calendario");

  useEffect(() => {
    try {
      const salvata = localStorage.getItem(CHIAVE);
      if (salvata === "calendario" || salvata === "gantt") setModalita(salvata);
    } catch {
      /* nessuna preferenza disponibile */
    }
  }, []);

  function cambia(v: Modalita) {
    setModalita(v);
    try {
      localStorage.setItem(CHIAVE, v);
    } catch {
      /* modalità privata: la scelta vale per la sessione */
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-0.5 self-start rounded border border-border2 bg-[var(--alpha-lighter)] p-0.5">
        {(
          [
            ["calendario", CalendarDays, "Calendario"],
            ["gantt", GanttChartSquare, "Gantt"],
          ] as const
        ).map(([v, Icona, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => cambia(v)}
            aria-pressed={modalita === v}
            className={cn(
              "flex h-6 items-center gap-1 rounded-[3px] px-2 text-xs transition-colors",
              modalita === v ? "bg-surface text-text shadow-[var(--shadow)]" : "text-muted hover:text-text",
            )}
          >
            <Icona size={13} strokeWidth={1.6} />
            {label}
          </button>
        ))}
      </div>

      {modalita === "calendario" ? (
        <CalendarioMese eventi={eventi} inizioMese={inizioMese} />
      ) : (
        <GanttRighe eventi={eventiRange} inizioRange={inizioRange} numeroGiorni={numeroGiorniRange} />
      )}
    </div>
  );
}

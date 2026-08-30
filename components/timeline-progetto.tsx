"use client";

import { useState } from "react";
import {
  GitCommit, FileText, MessageSquare, Receipt, Flag, CircleCheck,
  AlertTriangle, Pencil, ArrowRight, Clock, ChevronUp, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Evento = {
  id: string;
  tipo: string;
  testo: string;
  dettaglio: string | null;
  autore: string | null;
  createdAt: Date | string;
};

const STILE: Record<string, { icona: typeof GitCommit; tinta: string }> = {
  stato: { icona: ArrowRight, tinta: "var(--accent)" },
  attivita: { icona: CircleCheck, tinta: "var(--pos)" },
  milestone: { icona: Flag, tinta: "var(--accent)" },
  problema: { icona: AlertTriangle, tinta: "var(--neg)" },
  documento: { icona: FileText, tinta: "var(--muted)" },
  nota: { icona: MessageSquare, tinta: "var(--muted)" },
  fattura: { icona: Receipt, tinta: "var(--pos)" },
  ore: { icona: Clock, tinta: "var(--muted)" },
  modifica: { icona: Pencil, tinta: "var(--muted)" },
  github: { icona: GitCommit, tinta: "var(--muted)" },
};

/** "2 giorni fa", come nella timeline di Twenty. */
function quantoFa(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "ora";
  if (min < 60) return `${min} minuti fa`;
  const ore = Math.floor(min / 60);
  if (ore < 24) return `${ore} or${ore === 1 ? "a" : "e"} fa`;
  const gg = Math.floor(ore / 24);
  if (gg < 30) return `${gg} giorn${gg === 1 ? "o" : "i"} fa`;
  const mesi = Math.floor(gg / 30);
  return `${mesi} mes${mesi === 1 ? "e" : "i"} fa`;
}

function meseDi(d: Date | string) {
  return new Date(d).toLocaleDateString("it-IT", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Diario del progetto raggruppato per mese.
 *
 * Gli eventi con un dettaglio si espandono, come le modifiche a più campi
 * nella timeline di Twenty: la riga resta breve e il dettaglio è a un clic.
 */
export function TimelineProgetto({ eventi }: { eventi: Evento[] }) {
  if (eventi.length === 0) {
    return (
      <div className="px-3 py-8 text-center text-md text-faint">
        Nessun evento registrato.
        <br />
        Le azioni sul progetto compariranno qui.
      </div>
    );
  }

  // Raggruppa mantenendo l'ordine cronologico inverso già applicato dalla query.
  const gruppi: { mese: string; eventi: Evento[] }[] = [];
  for (const e of eventi) {
    const mese = meseDi(e.createdAt);
    const ultimo = gruppi[gruppi.length - 1];
    if (ultimo?.mese === mese) ultimo.eventi.push(e);
    else gruppi.push({ mese, eventi: [e] });
  }

  return (
    <div className="p-4">
      {gruppi.map((g) => (
        <div key={g.mese} className="mb-4 last:mb-0">
          <div className="mb-2 text-md text-faint">{g.mese}</div>
          <div className="relative">
            {/* Filo verticale che lega gli eventi del mese. */}
            <div
              className="absolute bottom-2 left-[11px] top-2 w-px"
              style={{ background: "var(--border)" }}
            />
            <div className="flex flex-col gap-1">
              {g.eventi.map((e) => (
                <Riga key={e.id} evento={e} />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Riga({ evento }: { evento: Evento }) {
  const [aperto, setAperto] = useState(false);
  const { icona: Icona, tinta } = STILE[evento.tipo] ?? STILE.modifica;
  const espandibile = Boolean(evento.dettaglio);

  return (
    <div className="relative flex items-start gap-2.5">
      <span
        className="z-10 mt-0.5 grid h-[22px] w-[22px] flex-none place-items-center rounded-full border"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Icona size={11} style={{ color: tinta }} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <span className="text-md">{evento.testo}</span>
            {espandibile && (
              <button
                onClick={() => setAperto((v) => !v)}
                className="ml-1.5 inline-grid h-4 w-4 translate-y-0.5 place-items-center rounded border border-border text-faint transition-colors hover:text-text"
              >
                <ChevronUp size={10} className={cn("transition-transform", !aperto && "rotate-180")} />
              </button>
            )}
            {evento.autore && (
              <span className="ml-1.5 text-xs text-faint">· {evento.autore}</span>
            )}
          </div>
          <span className="flex-none text-xs text-faint">
            {quantoFa(evento.createdAt)}
          </span>
        </div>

        {espandibile && aperto && (
          <div className="mt-1.5 rounded border border-border bg-surface2 px-2.5 py-2 text-md text-muted">
            {evento.dettaglio}
          </div>
        )}
      </div>
    </div>
  );
}

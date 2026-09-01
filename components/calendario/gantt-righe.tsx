"use client";

import Link from "next/link";
import type { EventoCalendario } from "@/lib/queries";
import { TINTA_EVENTO, ETICHETTA_TIPO } from "./tinte";

const GIORNO_MS = 86400000;
const ORDINE_TIPI: EventoCalendario["tipo"][] = ["progetto", "contratto", "milestone", "attivita", "fattura"];

function giorniDa(inizioRange: Date, data: Date) {
  return Math.round((data.getTime() - inizioRange.getTime()) / GIORNO_MS);
}

export function GanttRighe({
  eventi,
  inizioRange,
  numeroGiorni,
}: {
  eventi: EventoCalendario[];
  /** ISO della mezzanotte UTC del primo giorno del range visibile. */
  inizioRange: string;
  numeroGiorni: number;
}) {
  const inizio = new Date(inizioRange);
  const giorni = Array.from({ length: numeroGiorni }, (_, i) => {
    const d = new Date(inizio);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const griglia = `minmax(200px, 260px) repeat(${numeroGiorni}, minmax(24px, 1fr))`;

  const gruppi = ORDINE_TIPI.map((tipo) => ({
    tipo,
    eventi: eventi.filter((e) => e.tipo === tipo),
  })).filter((g) => g.eventi.length > 0);

  if (gruppi.length === 0) {
    return (
      <div className="rounded border border-border px-3 py-8 text-center text-md text-faint">
        Nessun evento in questo periodo.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded border border-border">
      <div style={{ minWidth: 200 + numeroGiorni * 24 }}>
        <div className="grid border-b border-border text-xs text-faint" style={{ gridTemplateColumns: griglia }}>
          <div className="px-2 py-1.5" />
          {giorni.map((d) => (
            <div key={d.toISOString()} className="border-l border-border py-1.5 text-center">
              {d.getUTCDate()}
            </div>
          ))}
        </div>

        {gruppi.map((gruppo) => (
          <div key={gruppo.tipo}>
            <div className="border-b border-border bg-surface2 px-2 py-1 text-xs font-medium text-faint">
              {ETICHETTA_TIPO[gruppo.tipo]}
            </div>
            {gruppo.eventi.map((e) => {
              const inizioCol = Math.max(1, giorniDa(inizio, e.inizio) + 1);
              const fineCol = Math.min(
                numeroGiorni + 1,
                (e.fine ? giorniDa(inizio, e.fine) : giorniDa(inizio, e.inizio)) + 2,
              );
              const dentroRange = inizioCol <= numeroGiorni && fineCol >= 1;

              return (
                <div
                  key={`${e.tipo}-${e.id}`}
                  className="grid items-center border-b border-border last:border-0 hover:bg-[var(--alpha-lighter)]"
                  style={{ gridTemplateColumns: griglia }}
                >
                  <Link href={e.link} title={e.titolo} className="min-w-0 truncate px-2 py-1.5 text-md hover:underline">
                    {e.titolo}
                    <span className="ml-1.5 text-xs text-faint">{e.contesto}</span>
                  </Link>
                  {dentroRange && (
                    <Link
                      href={e.link}
                      className="h-3.5 rounded-full"
                      style={{
                        gridColumnStart: Math.max(2, inizioCol + 1),
                        gridColumnEnd: Math.max(3, fineCol + 1),
                        background: `var(--tile-${TINTA_EVENTO[e.tipo]}-bg)`,
                        border: `1px solid var(--tile-${TINTA_EVENTO[e.tipo]}-bd)`,
                      }}
                      title={e.titolo}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

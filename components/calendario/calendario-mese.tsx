"use client";

import Link from "next/link";
import type { EventoCalendario } from "@/lib/queries";
import { TINTA_EVENTO } from "./tinte";

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MAX_PER_GIORNO = 3;

/** Chiave giorno in UTC, per raggruppare eventi indipendentemente dall'ora. */
function chiaveGiorno(d: Date) {
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

export function CalendarioMese({
  eventi,
  inizioMese,
}: {
  eventi: EventoCalendario[];
  /** ISO della mezzanotte UTC del primo giorno del mese visualizzato. */
  inizioMese: string;
}) {
  const primoGiorno = new Date(inizioMese);
  const numeroGiorniMese = new Date(
    Date.UTC(primoGiorno.getUTCFullYear(), primoGiorno.getUTCMonth() + 1, 0),
  ).getUTCDate();

  // Lunedì = 0: quanti giorni del mese precedente completano la prima riga.
  const scarto = (primoGiorno.getUTCDay() + 6) % 7;
  const primaCellaMese = new Date(primoGiorno);
  primaCellaMese.setUTCDate(primaCellaMese.getUTCDate() - scarto);

  const totaleCelle = Math.ceil((scarto + numeroGiorniMese) / 7) * 7;
  const celle = Array.from({ length: totaleCelle }, (_, i) => {
    const d = new Date(primaCellaMese);
    d.setUTCDate(d.getUTCDate() + i);
    return d;
  });

  const eventiPerGiorno = new Map<string, EventoCalendario[]>();
  for (const e of eventi) {
    const chiave = chiaveGiorno(e.inizio);
    const lista = eventiPerGiorno.get(chiave) ?? [];
    lista.push(e);
    eventiPerGiorno.set(chiave, lista);
  }

  return (
    <div className="rounded border border-border">
      <div className="grid grid-cols-7 border-b border-border text-xs font-medium text-faint">
        {GIORNI.map((g) => (
          <div key={g} className="px-2 py-1.5">{g}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celle.map((d) => {
          const fuoriMese = d.getUTCMonth() !== primoGiorno.getUTCMonth();
          const eventiGiorno = eventiPerGiorno.get(chiaveGiorno(d)) ?? [];
          const visibili = eventiGiorno.slice(0, MAX_PER_GIORNO);
          const altri = eventiGiorno.length - visibili.length;
          return (
            <div
              key={d.toISOString()}
              className={`min-h-[84px] border-b border-r border-border p-1.5 last:border-r-0 ${fuoriMese ? "opacity-40" : ""}`}
            >
              <div className="text-xs text-faint">{d.getUTCDate()}</div>
              <div className="mt-1 flex flex-col gap-0.5">
                {visibili.map((e) => (
                  <Link
                    key={`${e.tipo}-${e.id}`}
                    href={e.link}
                    title={e.titolo}
                    className="truncate rounded-[3px] px-1 py-0.5 text-xs hover:opacity-80"
                    style={{
                      background: `var(--tile-${TINTA_EVENTO[e.tipo]}-bg)`,
                      color: `var(--tile-${TINTA_EVENTO[e.tipo]}-ic)`,
                    }}
                  >
                    {e.titolo}
                  </Link>
                ))}
                {altri > 0 && (
                  <div className="px-1 text-xs text-faint">+{altri} altri</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

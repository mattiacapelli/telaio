import { getSettimana, getRiferimentiOre } from "@/lib/queries";
import { InserisciOre } from "@/components/inserisci-ore";
import { Card } from "@/components/ui/card";
import { Vuoto } from "@/components/ui-legacy";
import { ore } from "@/lib/format";

export const dynamic = "force-dynamic";

const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

export default async function OrePage({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s } = await searchParams;
  const offset = Number(s ?? 0) || 0;
  const [settimana, riferimenti] = await Promise.all([
    getSettimana(offset),
    getRiferimentiOre(),
  ]);

  // Le date della settimana sono in UTC (vedi inizioSettimana): le leggiamo
  // con i getter UTC, altrimenti il numero del giorno slitta secondo il fuso.
  const giorni = GIORNI.map((g, i) => {
    const d = new Date(settimana.inizio);
    d.setUTCDate(d.getUTCDate() + i);
    return { nome: g, numero: d.getUTCDate() };
  });

  const periodo = `${settimana.inizio.getUTCDate()} – ${new Date(
    settimana.fine.getTime() - 86400000,
  ).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })}`;

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <a
            href={`/ore?s=${offset - 1}`}
            className="grid h-6 w-6 place-items-center rounded border border-border2 bg-[var(--alpha-lighter)] text-muted hover:bg-[var(--alpha-light)] hover:text-text"
          >
            ‹
          </a>
          <div className="px-2 text-md font-medium">{periodo}</div>
          <a
            href={`/ore?s=${offset + 1}`}
            className="grid h-6 w-6 place-items-center rounded border border-border2 bg-[var(--alpha-lighter)] text-muted hover:bg-[var(--alpha-light)] hover:text-text"
          >
            ›
          </a>
          {offset !== 0 && (
            <a
              href="/ore"
              className="ml-1 h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-md text-muted hover:text-text"
            >
              Questa settimana
            </a>
          )}
        </div>
        <div className="flex-1" />
        <InserisciOre
          progetti={riferimenti.progetti}
          attivita={riferimenti.attivita}
          ticket={riferimenti.ticket}
        />
        <span className="text-md text-muted">
          Totale settimana <strong className="text-text">{ore(settimana.totale)}</strong> · da
          fatturare <strong className="text-text">{ore(settimana.daFatturare)}</strong>
        </span>
      </div>

      {settimana.righe.length === 0 ? (
        <Vuoto
          titolo="Nessuna ora registrata"
          nota="Avvia il timer da un'attività o da un ticket per iniziare a tracciare."
        />
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(200px,2fr)_repeat(7,1fr)_70px] gap-1 border-b border-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-faint">
              <span>Progetto / attività</span>
              {giorni.map((g) => (
                <span key={g.nome} className="text-center">
                  {g.nome} {g.numero}
                </span>
              ))}
              <span className="text-right">Tot</span>
            </div>

            {settimana.righe.map((r) => (
              <div
                key={r.etichetta}
                className="grid grid-cols-[minmax(200px,2fr)_repeat(7,1fr)_70px] items-center gap-1 border-b border-border px-3 py-2 last:border-0"
              >
                <div className="min-w-0">
                  <div className="truncate text-md">{r.etichetta}</div>
                  <div className="truncate text-xs text-faint">
                    {r.contesto}
                  </div>
                </div>
                {r.giorni.map((h, i) => {
                  const giorno = new Date(settimana.inizio);
                  giorno.setUTCDate(giorno.getUTCDate() + i);
                  const iso = giorno.toISOString().slice(0, 10);
                  return (
                    <div key={i} className="flex h-6 items-center justify-center">
                      {h > 0 ? (
                        <span className="text-center text-md tabular-nums text-text">
                          {h.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                        </span>
                      ) : (
                        <InserisciOre
                          progetti={riferimenti.progetti}
                          attivita={riferimenti.attivita}
                          ticket={riferimenti.ticket}
                          dataIniziale={iso}
                          compatto
                        />
                      )}
                    </div>
                  );
                })}
                <span className="text-right text-md font-semibold tabular-nums">
                  {r.totale.toLocaleString("it-IT", { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

import { getCalendario, inizioMese } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Vuoto } from "@/components/ui-legacy";
import { VistaCalendario } from "@/components/calendario/vista-calendario";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Calendario") };
}

const MESI = [
  "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
  "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre",
];

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const offset = Number(m ?? 0) || 0;

  const inizio = inizioMese(offset);
  const fine = inizioMese(offset + 1);

  const eventi = await getCalendario();

  const eventiMese = eventi.filter(
    (e) => e.inizio >= inizio && e.inizio < fine,
  );

  // Il Gantt copre il mese con qualche giorno di margine ai lati, per non
  // troncare barre che iniziano poco prima o finiscono poco dopo il mese.
  const inizioRange = new Date(inizio);
  inizioRange.setUTCDate(inizioRange.getUTCDate() - 5);
  const fineRange = new Date(fine);
  fineRange.setUTCDate(fineRange.getUTCDate() + 5);
  const numeroGiorniRange = Math.round(
    (fineRange.getTime() - inizioRange.getTime()) / 86400000,
  );
  const eventiRange = eventi.filter((e) => {
    const inizioEvento = e.inizio < inizioRange ? inizioRange : e.inizio;
    const fineEvento = e.fine ?? e.inizio;
    return inizioEvento < fineRange && fineEvento >= inizioRange;
  });

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <a
            href={`/calendario?m=${offset - 1}`}
            className="grid h-6 w-6 place-items-center rounded border border-border2 bg-[var(--alpha-lighter)] text-muted hover:bg-[var(--alpha-light)] hover:text-text"
          >
            ‹
          </a>
          <div className="px-2 text-md font-medium">
            {MESI[inizio.getUTCMonth()]} {inizio.getUTCFullYear()}
          </div>
          <a
            href={`/calendario?m=${offset + 1}`}
            className="grid h-6 w-6 place-items-center rounded border border-border2 bg-[var(--alpha-lighter)] text-muted hover:bg-[var(--alpha-light)] hover:text-text"
          >
            ›
          </a>
          {offset !== 0 && (
            <a
              href="/calendario"
              className="ml-1 h-6 rounded border border-border2 bg-[var(--alpha-lighter)] px-2 text-md text-muted hover:text-text"
            >
              Questo mese
            </a>
          )}
        </div>
      </div>

      {eventiMese.length === 0 && eventiRange.length === 0 ? (
        <Vuoto
          titolo="Nessun evento in questo mese"
          nota="Progetti, attività, milestone, contratti e fatture con una data compariranno qui."
        />
      ) : (
        <VistaCalendario
          eventi={eventiMese}
          eventiRange={eventiRange}
          inizioMese={inizio.toISOString()}
          inizioRange={inizioRange.toISOString()}
          numeroGiorniRange={numeroGiorniRange}
        />
      )}
    </div>
  );
}

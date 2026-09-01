import Link from "next/link";
import { getPreventivi } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { Badge } from "@/components/ui/badge";
import { eur, data } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · Preventivi") };
}

const STATI_ORDINE = ["BOZZA", "INVIATO", "ACCETTATO", "RIFIUTATO"] as const;

const STATI: Record<string, string> = {
  BOZZA: "Bozza",
  INVIATO: "Inviato",
  ACCETTATO: "Accettato",
  RIFIUTATO: "Rifiutato",
};

export default async function DashboardPreventiviPage() {
  const preventivi = await getPreventivi();

  if (preventivi.length === 0) {
    return <Vuoto titolo="Nessun preventivo" nota="La pipeline commerciale comparirà qui." />;
  }

  const inTrattativa = preventivi.filter((p) => p.stato === "BOZZA" || p.stato === "INVIATO");
  const valoreInTrattativa = inTrattativa.reduce((s, p) => s + p.imponibile, 0);
  const accettati = preventivi.filter((p) => p.stato === "ACCETTATO");
  const rifiutati = preventivi.filter((p) => p.stato === "RIFIUTATO");
  const chiusi = accettati.length + rifiutati.length;
  const tassoChiusura = chiusi > 0 ? (accettati.length / chiusi) * 100 : null;
  const valoreMedio = preventivi.reduce((s, p) => s + p.imponibile, 0) / preventivi.length;

  const perStato = STATI_ORDINE.map((s) => ({
    stato: s,
    conteggio: preventivi.filter((p) => p.stato === s).length,
  }));
  const maxStato = Math.max(...perStato.map((s) => s.conteggio), 1);

  const inScadenza = preventivi
    .filter((p) => p.stato === "INVIATO" && p.scadeIl)
    .sort((a, b) => (a.scadeIl! < b.scadeIl! ? -1 : 1))
    .slice(0, 8);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etichetta="In trattativa" valore={eur(valoreInTrattativa)} nota={`${inTrattativa.length} preventivi`} />
        <Stat etichetta="Preventivi totali" valore={String(preventivi.length)} />
        <Stat
          etichetta="Tasso di chiusura"
          valore={tassoChiusura === null ? "—" : `${Math.round(tassoChiusura)}%`}
          nota={`${accettati.length} accettati su ${chiusi}`}
        />
        <Stat etichetta="Valore medio" valore={eur(valoreMedio)} />
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <Card>
          <CardHead titolo="Per stato" />
          <div className="flex flex-col gap-2 p-3">
            {perStato.map((s) => (
              <div key={s.stato} className="flex items-center gap-2 text-md">
                <span className="w-24 flex-none text-muted">{STATI[s.stato]}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${(s.conteggio / maxStato) * 100}%` }}
                  />
                </div>
                <span className="w-8 flex-none text-right text-xs text-faint">{s.conteggio}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHead
            titolo="In scadenza"
            extra={<Link href="/preventivi" className="text-xs text-muted hover:text-text">Tutti</Link>}
          />
          {inScadenza.length === 0 ? (
            <div className="px-3 py-6 text-center text-md text-faint">Nessun preventivo inviato in scadenza.</div>
          ) : (
            <div>
              {inScadenza.map((p) => (
                <Link
                  key={p.id}
                  href={`/preventivi/${p.id}`}
                  className="flex items-center gap-3 border-b border-border px-3 py-2 last:border-0 hover:bg-[var(--alpha-lighter)]"
                >
                  <span className="text-xs text-faint">{p.numero}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-md">{p.titolo}</div>
                    <div className="text-xs text-faint">{p.cliente}</div>
                  </div>
                  {p.scadeIl && <Badge>scade {data(p.scadeIl)}</Badge>}
                  <span className="w-20 flex-none text-right text-md">{eur(p.imponibile)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

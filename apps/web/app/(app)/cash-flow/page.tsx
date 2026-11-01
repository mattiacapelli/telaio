import { formatEuro, formatEuroCompatto } from "@telaio/core";
import { getDb } from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { Switch } from "@/components/ui/switch";
import { calcolaCashFlow } from "@/lib/dominio/cashflow";

export const metadata = { title: "Cash flow" };
export const dynamic = "force-dynamic";

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ pv?: string; prud?: string }>;
}) {
  const { pv = "1", prud = "0" } = await searchParams;
  const conPreventivi = pv === "1";
  const prudente = prud === "1";
  const { liquidita, nConti, serie } = await calcolaCashFlow(getDb(), { conPreventivi, prudente });
  const contiAttivi = { length: nConti };
  const massimo = Math.max(1, ...serie.map((r) => Math.max(r.certi + r.pesati, r.uscite)));
  const minimo = serie.reduce(
    (a, b) => (b.saldo < a.saldo ? b : a),
    serie[0] ?? { saldo: 0, lungo: "—" },
  );
  const fine = serie.at(-1)?.saldo ?? liquidita;
  const maxS = Math.max(...serie.map((r) => r.saldo), liquidita);
  const minS = Math.min(...serie.map((r) => r.saldo), liquidita);
  const punti = serie
    .map(
      (r, i) =>
        `${(i / Math.max(1, serie.length - 1)) * 100},${100 - ((r.saldo - minS) / Math.max(1, maxS - minS)) * 100}`,
    )
    .join(" ");
  const href = (p: Record<string, string>) =>
    `/cash-flow?${new URLSearchParams({ pv, prud, ...p })}`;

  return (
    <>
      <PageHeader
        titolo="Cash flow"
        descrizione="Parte dalla liquidità di oggi, aggiunge le rate in scadenza e toglie la spesa media degli ultimi tre mesi. I preventivi in attesa li conti solo se vuoi, pesati al 50%."
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/scadenzario">Scadenzario</Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href="/report">Report</Link>
            </Button>
          </>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        {[
          {
            on: conPreventivi,
            href: href({ pv: conPreventivi ? "0" : "1" }),
            testo: "Includi preventivi in attesa, pesati per probabilità",
          },
          {
            on: prudente,
            href: href({ prud: prudente ? "0" : "1" }),
            testo: "Scenario prudente: incassi in ritardo di un mese",
          },
        ].map((o) => (
          <Link
            key={o.testo}
            href={o.href}
            className="flex items-center gap-3 text-sm"
            aria-label={o.testo}
          >
            <Switch label={o.testo} checked={o.on} tabIndex={-1} className="pointer-events-none" />
            {o.testo}
          </Link>
        ))}
      </Card>

      <StatsRow
        dati={[
          {
            etichetta: "Liquidità oggi",
            valore: formatEuro(liquidita),
            nota: `${contiAttivi.length} conti`,
          },
          {
            etichetta: "Fra sei mesi",
            valore: formatEuro(fine),
            nota: `${fine >= liquidita ? "+" : "−"} ${formatEuro(Math.abs(fine - liquidita))} rispetto a oggi`,
          },
          {
            etichetta: "Mese più stretto",
            valore: minimo.lungo,
            nota: `saldo minimo ${formatEuroCompatto(minimo.saldo)}`,
          },
        ]}
      />

      <Card>
        <CardHeader
          title="Entrate e uscite previste"
          action={
            <div className="flex flex-wrap gap-3 text-xs text-fg-2">
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2 rounded-sm bg-brand" />
                Incassi certi
              </span>
              {conPreventivi && (
                <span className="inline-flex items-center gap-1.5">
                  <i className="size-2 rounded-sm bg-fg-3" />
                  Preventivi pesati
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <i className="size-2 rounded-sm bg-bad" />
                Uscite stimate
              </span>
            </div>
          }
        />
        <div className="grid h-56 grid-cols-6 items-end gap-4 border-b border-line">
          {serie.map((r) => (
            <div key={r.ym} className="flex h-full items-end gap-1">
              <div
                className="flex flex-1 flex-col overflow-hidden rounded-t-sm"
                style={{ height: `${((r.certi + r.pesati) / massimo) * 100}%` }}
              >
                <div className="bg-fg-3" style={{ flex: r.pesati }} />
                <div className="bg-brand" style={{ flex: r.certi }} />
              </div>
              <div
                className="flex-1 rounded-t-sm bg-bad/80"
                style={{ height: `${(r.uscite / massimo) * 100}%` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-6 gap-4 text-center text-xs text-fg-2">
          {serie.map((r) => (
            <span key={r.ym}>{r.label}</span>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Saldo di cassa a fine mese"
          description={`Somma dei ${contiAttivi.length} conti`}
        />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
          <polyline
            points={punti}
            fill="none"
            stroke="var(--brand)"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-2 grid grid-cols-6 gap-4 text-center">
          {serie.map((r) => (
            <div key={r.ym} className="flex flex-col leading-tight">
              <span className="text-xs text-fg-2">{r.label}</span>
              <b className="text-sm font-medium tabular-nums">{formatEuroCompatto(r.saldo)}</b>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-0">
        <div className="p-4 pb-2">
          <CardHeader title="Dettaglio per mese" className="mb-0" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-line bg-subtle text-xs font-medium text-fg-2">
                <th className="h-8 px-4 text-left">Mese</th>
                <th className="px-4 text-right">Incassi certi</th>
                <th className="px-4 text-right">Preventivi pesati</th>
                <th className="px-4 text-right">Uscite stimate</th>
                <th className="px-4 text-right">Saldo fine mese</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((r) => (
                <tr key={r.ym} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2 font-medium">{r.lungo}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{formatEuro(r.certi)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {conPreventivi ? formatEuro(r.pesati) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">− {formatEuro(r.uscite)}</td>
                  <td className="px-4 py-2 text-right font-medium tabular-nums">
                    {formatEuro(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line px-4 py-3 text-xs text-fg-2">
          Le uscite sono la media mensile degli ultimi tre mesi di prima nota; le scadenze fiscali
          non sono ancora incluse.
        </p>
      </Card>
    </>
  );
}

import { formatEuro, formatEuroCompatto } from "@telaio/core";
import {
  and,
  conti,
  desc,
  eq,
  fatturaRighe,
  fatture,
  getDb,
  gte,
  isNull,
  lt,
  movimenti,
  ragioniSociali,
  sql,
} from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { FilterLinks } from "@/components/ui/filter-links";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { oggi } from "@/lib/date";
import { intervallo, type Periodo, valorePeriodo } from "@/lib/periodo";

export const metadata = { title: "Report ed export" };
export const dynamic = "force-dynamic";

const PERIODI: [Periodo, string][] = [
  ["mese", "Mese"],
  ["trimestre", "Trimestre"],
  ["anno", "Anno"],
];

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const p = valorePeriodo((await searchParams).p);
  const { da, a, etichetta } = intervallo(p, oggi());
  const db = getDb();
  const emesse = and(
    isNull(fatture.deletedAt),
    gte(fatture.dataEmissione, da),
    lt(fatture.dataEmissione, a),
    sql`${fatture.stato} <> 'bozza'`,
  );

  const [emittenti, perEmittente, costi, voci, clienti] = await Promise.all([
    db.select().from(ragioniSociali).where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        id: fatture.ragioneSocialeId,
        ricavi: sql<number>`coalesce(sum(${fatture.imponibileCent}),0)::int`,
        iva: sql<number>`coalesce(sum(${fatture.ivaCent}),0)::int`,
      })
      .from(fatture)
      .where(emesse)
      .groupBy(fatture.ragioneSocialeId),
    db
      .select({
        id: conti.ragioneSocialeId,
        tot: sql<number>`coalesce(sum(${movimenti.importoCent}),0)::int`,
      })
      .from(movimenti)
      .innerJoin(conti, eq(conti.id, movimenti.contoId))
      .where(
        and(
          isNull(movimenti.deletedAt),
          eq(movimenti.tipo, "uscita"),
          gte(movimenti.data, da),
          lt(movimenti.data, a),
        ),
      )
      .groupBy(conti.ragioneSocialeId),
    db
      .select({
        nome: fatturaRighe.descrizione,
        n: sql<number>`count(*)::int`,
        tot: sql<number>`sum(${fatturaRighe.importoCent})::int`,
      })
      .from(fatturaRighe)
      .innerJoin(fatture, eq(fatture.id, fatturaRighe.fatturaId))
      .where(emesse)
      .groupBy(fatturaRighe.descrizione)
      .orderBy(desc(sql`sum(${fatturaRighe.importoCent})`))
      .limit(7),
    db
      .select({
        nome: sql<string>`coalesce(${fatture.snapshot}->'cliente'->>'nome','—')`,
        tot: sql<number>`sum(${fatture.imponibileCent})::int`,
      })
      .from(fatture)
      .where(emesse)
      .groupBy(sql`1`)
      .orderBy(desc(sql`sum(${fatture.imponibileCent})`))
      .limit(5),
  ]);

  const ricavi = perEmittente.reduce((s, r) => s + r.ricavi, 0);
  const iva = perEmittente.reduce((s, r) => s + r.iva, 0);
  const costiTot = costi.reduce((s, r) => s + r.tot, 0);
  const margine = ricavi - costiTot;
  const maxVoce = Math.max(1, ...voci.map((v) => v.tot));

  return (
    <>
      <PageHeader
        titolo="Report ed export"
        descrizione={`Come stanno andando i conti. Periodo: ${etichetta.toLowerCase()}.`}
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/cash-flow">Cash flow</Link>
            </Button>
            <Button asChild>
              <a href={`/api/export/commercialista?tipo=fatture&p=${p}`}>Export commercialista</a>
            </Button>
          </>
        }
      />

      <FilterLinks
        etichetta="Periodo"
        attiva={p}
        voci={PERIODI.map(([id, l]) => ({ id, label: l, href: `/report?p=${id}` }))}
      />

      <StatsRow
        dati={[
          { etichetta: "Ricavi netti", valore: formatEuroCompatto(ricavi) },
          { etichetta: "IVA fatturata", valore: formatEuroCompatto(iva) },
          { etichetta: "Costi netti", valore: formatEuroCompatto(costiTot) },
          {
            etichetta: "Margine",
            valore: formatEuroCompatto(margine),
            nota: ricavi ? `${Math.round((margine / ricavi) * 100)}% dei ricavi` : undefined,
          },
        ]}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {emittenti.map((e) => {
          const r = perEmittente.find((x) => x.id === e.id);
          const c = costi.find((x) => x.id === e.id)?.tot ?? 0;
          const ric = r?.ricavi ?? 0;
          const m = ric - c;
          return (
            <Card key={e.id} className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-base font-semibold">{e.nome}</span>
                <span className="text-xs text-fg-3">
                  {e.ivaAttiva ? `IVA ${e.aliquotaIvaBp / 100}%` : "senza IVA"}
                </span>
              </div>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatEuroCompatto(ric)}
              </span>
              <div className="h-1.5 rounded-full bg-hover">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${ricavi ? Math.max(3, (ric / ricavi) * 100) : 0}%` }}
                />
              </div>
              <dl className="divide-y divide-line text-sm">
                {[
                  ["IVA", e.ivaAttiva ? formatEuro(r?.iva ?? 0) : "non applicata"],
                  ["Costi", formatEuro(c)],
                  ["Margine", `${formatEuro(m)}${ric ? ` · ${Math.round((m / ric) * 100)}%` : ""}`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1.5">
                    <dt className="text-fg-2">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Voci vendute" description={`${etichetta} · netto`} />
          {voci.length === 0 ? (
            <p className="text-sm text-fg-2">Nessuna fattura emessa nel periodo.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {voci.map((v) => (
                <div key={v.nome} className="flex flex-col gap-1">
                  <div className="flex justify-between gap-3 text-sm">
                    <span className="truncate">
                      {v.nome}{" "}
                      <span className="text-fg-3">
                        · {v.n} vendit{v.n === 1 ? "a" : "e"}
                      </span>
                    </span>
                    <b className="font-medium tabular-nums">{formatEuroCompatto(v.tot)}</b>
                  </div>
                  <div className="h-1.5 rounded-full bg-hover">
                    <div
                      className="h-full rounded-full bg-brand"
                      style={{ width: `${Math.max(3, (v.tot / maxVoce) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Clienti principali" description={`${etichetta} · netto`} />
          {clienti.length === 0 ? (
            <p className="text-sm text-fg-2">Nessuna fattura emessa nel periodo.</p>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {clienti.map((c) => (
                <li key={c.nome} className="flex justify-between gap-3 py-2">
                  <span className="font-medium">{c.nome}</span>
                  <b className="font-medium tabular-nums">{formatEuroCompatto(c.tot)}</b>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Export per il commercialista"
          description={`File CSV (separatore «;», importi con la virgola) del periodo: ${etichetta.toLowerCase()}.`}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <a href={`/api/export/commercialista?tipo=fatture&p=${p}`}>Fatture emesse ↓</a>
          </Button>
          <Button asChild variant="secondary">
            <a href={`/api/export/commercialista?tipo=prima-nota&p=${p}`}>Prima nota ↓</a>
          </Button>
        </div>
      </Card>
    </>
  );
}

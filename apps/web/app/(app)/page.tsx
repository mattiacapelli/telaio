import { formatEuro } from "@telaio/core";
import { and, eq, getDb, isNull, preventivi, rate, sql } from "@telaio/db";
import Link from "next/link";
import { Card, InkPanel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const db = getDb();
  const [[bozze], [aperti], [scaduto]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(preventivi).where(and(isNull(preventivi.deletedAt), eq(preventivi.stato, "bozza"))),
    db.select({ n: sql<number>`count(*)::int`, tot: sql<number>`coalesce(sum(${preventivi.totaleCent}),0)::int` }).from(preventivi).where(and(isNull(preventivi.deletedAt), eq(preventivi.stato, "inviato"))),
    db.select({ n: sql<number>`count(*)::int`, tot: sql<number>`coalesce(sum(${rate.importoCent}),0)::int` }).from(rate).where(eq(rate.stato, "scaduta")),
  ]);

  return (
    <>
      <PageHeader sezione="Panoramica" titolo="Dashboard" descrizione="Cosa richiede attenzione oggi." />
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="eyebrow">Preventivi in bozza</p>
          <p className="money mt-3 text-5xl font-semibold">{bozze?.n ?? 0}</p>
          <Link href="/preventivi" className="mt-4 inline-block text-sm text-blue underline-offset-4 hover:underline">Apri preventivi</Link>
        </Card>
        <Card>
          <p className="eyebrow">Inviati, in attesa</p>
          <p className="money mt-3 text-5xl font-semibold">{aperti?.n ?? 0}</p>
          <p className="mt-2 text-sm text-muted">{formatEuro(aperti?.tot ?? 0)} di imponibile e IVA</p>
        </Card>
        <InkPanel>
          <p className="eyebrow !text-grey-2">Rate scadute</p>
          <p className="money mt-3 text-5xl font-semibold">{formatEuro(scaduto?.tot ?? 0)}</p>
          <div className="mt-3">
            <Tag tone={scaduto?.n ? "orange" : "green"}>{scaduto?.n ? `${scaduto.n} da sollecitare` : "Tutto in regola"}</Tag>
          </div>
        </InkPanel>
      </div>
    </>
  );
}

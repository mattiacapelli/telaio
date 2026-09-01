import Link from "next/link";
import { getProdotti } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card, CardHead } from "@/components/ui/card";
import { Stat, Vuoto, Barra } from "@/components/ui-legacy";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Dashboard · Prodotti") };
}

export default async function DashboardProdottiPage() {
  const prodotti = await getProdotti();

  if (prodotti.length === 0) {
    return <Vuoto titolo="Nessun prodotto" nota="Il catalogo prodotti e le licenze compariranno qui." />;
  }

  const licenzeAttiveTotali = prodotti.reduce((s, p) => s + p.licenzeAttive, 0);
  const pianiTotali = prodotti.reduce((s, p) => s + p.piani, 0);
  const senzaLicenze = prodotti.filter((p) => p.licenzeTotali === 0);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat etichetta="Prodotti a catalogo" valore={String(prodotti.length)} />
        <Stat etichetta="Licenze attive" valore={String(licenzeAttiveTotali)} />
        <Stat etichetta="Piani configurati" valore={String(pianiTotali)} />
        <Stat
          etichetta="Senza licenze"
          valore={String(senzaLicenze.length)}
          nota={senzaLicenze.length > 0 ? "prodotti senza clienti" : "tutti in uso"}
        />
      </div>

      <Card>
        <CardHead titolo="Prodotti" extra={<Link href="/prodotti" className="text-xs text-muted hover:text-text">Tutti</Link>} />
        <div>
          {prodotti.map((p) => (
            <Link
              key={p.id}
              href={`/prodotti/${p.id}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-[var(--alpha-lighter)]"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-md font-medium">{p.nome}</div>
                {p.progetto && <div className="text-xs text-faint">{p.progetto}</div>}
              </div>
              <div className="w-24 flex-none">
                <Barra valore={p.licenzeAttive} max={Math.max(p.licenzeTotali, 1)} />
              </div>
              {p.licenzeTotali === 0 ? (
                <Badge>senza licenze</Badge>
              ) : (
                <Badge tono="accento">{p.licenzeAttive}/{p.licenzeTotali}</Badge>
              )}
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

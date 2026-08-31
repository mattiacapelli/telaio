import Link from "next/link";
import { getProdotti, getProgettiPerSelezione } from "@/lib/queries";
import { titoloPagina } from "@/lib/titolo";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Stat, Vuoto } from "@/components/ui-legacy";
import { NuovoProdotto } from "@/components/nuovo-prodotto";
import { eur } from "@/lib/format";
import { Package } from "lucide-react";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: await titoloPagina("Prodotti") };
}

export default async function ProdottiPage() {
  const [prodotti, progetti] = await Promise.all([getProdotti(), getProgettiPerSelezione()]);

  const licenzeAttiveTotali = prodotti.reduce((s, p) => s + p.licenzeAttive, 0);

  return (
    <div className="tl-in flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-md text-muted">
          {prodotti.length} prodotti · {licenzeAttiveTotali} licenze attive
        </span>
        <div className="flex-1" />
        <NuovoProdotto progetti={progetti} />
      </div>

      {prodotti.length > 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          <Stat etichetta="Prodotti a catalogo" valore={String(prodotti.length)} />
          <Stat etichetta="Licenze attive" valore={String(licenzeAttiveTotali)} />
        </div>
      )}

      {prodotti.length === 0 ? (
        <Vuoto
          titolo="Nessun prodotto"
          nota="Registra qui i tuoi software venduti a più clienti, con le relative licenze."
        />
      ) : (
        <Card>
          {prodotti.map((p) => (
            <Link
              key={p.id}
              href={`/prodotti/${p.id}`}
              className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0 hover:bg-[var(--alpha-lighter)]"
            >
              <Package size={14} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-md font-medium">{p.nome}</span>
                  {p.progetto && <Badge>{p.progetto}</Badge>}
                </div>
                {p.descrizione && (
                  <div className="mt-0.5 truncate text-xs text-faint">{p.descrizione}</div>
                )}
              </div>
              <div className="flex-none text-right">
                <div className="text-md font-medium">
                  {p.licenzeAttive} / {p.licenzeTotali} licenze
                </div>
                {p.prezzoListino !== null && (
                  <div className="text-xs text-faint">{eur(p.prezzoListino)} a listino</div>
                )}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}

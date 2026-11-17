import { ETICHETTE_STATO_MONTE_ORE, formattaOre } from "@telaio/core";
import { clientiRef, getDb, isNull, riepilogoMonteOre } from "@telaio/db";
import Link from "next/link";
import { BarraOre } from "@/components/domain/barra-ore";
import { MonteOreModal } from "@/components/domain/monte-ore-modal";
import { Badge } from "@/components/ui/badge";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatData, oggi } from "@/lib/date";
import { elencaEmittenti } from "@/lib/tempo-opzioni";

export const metadata = { title: "Monte ore" };
export const dynamic = "force-dynamic";

export default async function MonteOrePage() {
  const db = getDb();
  const [contratti, clienti, emittenti] = await Promise.all([
    riepilogoMonteOre(db, oggi()),
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    elencaEmittenti(db),
  ]);

  return (
    <>
      <PageHeader
        titolo="Monte ore"
        descrizione="Contratti a ore: quante ore restano ai clienti nel periodo in corso."
        azioni={<MonteOreModal clienti={clienti} emittenti={emittenti} />}
      />
      {contratti.length === 0 ? (
        <EmptyState title="Nessun contratto a ore">
          Crea un monte ore per un cliente, per esempio 10 ore al mese.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {contratti.map(({ contratto: m, cliente, corrente }) => (
            <Card key={m.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link href={`/monte-ore/${m.id}`} className="font-medium hover:underline">
                    {m.nome}
                  </Link>
                  <p className="truncate text-sm text-fg-2">{cliente}</p>
                </div>
                <Badge variant={m.stato === "attivo" ? "ok" : "neutral"} dot>
                  {ETICHETTE_STATO_MONTE_ORE[m.stato]}
                </Badge>
              </div>
              {corrente ? (
                <>
                  <p className="text-xs text-fg-3 tabular-nums">
                    Periodo {formatData(corrente.inizio)} – {formatData(corrente.fine)}
                  </p>
                  <BarraOre saldo={corrente} />
                </>
              ) : (
                <p className="text-sm text-fg-2">
                  Inizia il {formatData(m.dataInizio)} · {formattaOre(m.minutiIncluse)} per periodo
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

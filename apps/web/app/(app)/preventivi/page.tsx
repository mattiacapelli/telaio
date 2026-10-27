import { formatEuro } from "@telaio/core";
import { clientiRef, desc, eq, getDb, isNull, preventivi, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { STATO_PREVENTIVO } from "@/lib/stati";

export const metadata = { title: "Preventivi" };
export const dynamic = "force-dynamic";

export default async function PreventiviPage() {
  const righe = await getDb()
    .select({ p: preventivi, emittente: ragioniSociali.nome, cliente: clientiRef.nome })
    .from(preventivi)
    .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
    .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
    .where(isNull(preventivi.deletedAt))
    .orderBy(desc(preventivi.createdAt))
    .limit(100);

  return (
    <>
      <PageHeader numero="02" sezione="Commerciale" titolo="Preventivi" descrizione="Bozze, inviati, accettati. Si creano dal configuratore." />
      {righe.length === 0 ? (
        <EmptyState
          title="Nessun preventivo"
          action={
            <Button asChild>
              <Link href="/configuratore">Apri il configuratore</Link>
            </Button>
          }
        >
          Scegli una base e i moduli compatibili: il preventivo nasce come bozza.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Preventivo</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Emittente</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 text-right font-medium">Una tantum</th>
              </tr>
            </thead>
            <tbody>
              {righe.map(({ p, emittente, cliente }) => {
                const stato = STATO_PREVENTIVO[p.stato];
                return (
                  <tr key={p.id} className="border-t border-grey-2/60">
                    <td className="px-4 py-3">
                      <Link href={`/preventivi/${p.id}`} className="inline-flex min-h-11 flex-col justify-center font-medium underline-offset-4 hover:underline">
                        {p.oggetto}
                        <span className="text-xs font-normal text-muted">{p.numero ?? "Senza numero"}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{cliente ?? "Da assegnare"}</td>
                    <td className="px-4 py-3 text-ink-2">{emittente}</td>
                    <td className="px-4 py-3"><Tag tone={stato?.tone}>{stato?.label ?? p.stato}</Tag></td>
                    <td className="money px-4 py-3 text-right tabular-nums">{formatEuro(p.totaleCent)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}

import { formatEuro } from "@telaio/core";
import { clientiRef, desc, eq, fatture, getDb, isNull, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { FatturaLiberaModal } from "@/components/domain/fattura-libera-modal";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_FATTURA } from "@/lib/stati";

export const metadata = { title: "Fatture" };
export const dynamic = "force-dynamic";

export default async function FatturePage() {
  const db = getDb();
  const [clienti, emittenti] = await Promise.all([
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
  ]);
  const lista = await db
    .select({ f: fatture, emittente: ragioniSociali.nome, cliente: clientiRef.nome })
    .from(fatture)
    .innerJoin(ragioniSociali, eq(ragioniSociali.id, fatture.ragioneSocialeId))
    .leftJoin(clientiRef, eq(clientiRef.id, fatture.clienteRefId))
    .where(isNull(fatture.deletedAt))
    .orderBy(desc(fatture.createdAt))
    .limit(200);

  return (
    <>
      <PageHeader
        numero="06"
        sezione="Amministrazione"
        titolo="Fatture"
        descrizione="Da un preventivo accettato oppure libere. L'invio elettronico passa da un intermediario (da collegare)."
        azione={<FatturaLiberaModal clienti={clienti} emittenti={emittenti} />}
      />
      {lista.length === 0 ? (
        <EmptyState title="Nessuna fattura">
          Accetta un preventivo e usa «Crea fattura» dal suo dettaglio.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Fattura</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Emissione</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 text-right font-medium">Totale</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ f, emittente, cliente }) => {
                const stato = STATO_FATTURA[f.stato];
                return (
                  <tr key={f.id} className="border-t border-grey-2/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/fatture/${f.id}`}
                        className="inline-flex min-h-11 flex-col justify-center font-medium underline-offset-4 hover:underline"
                      >
                        {f.numero ?? "Bozza"}
                        <span className="text-xs font-normal text-muted">{emittente}</span>
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{cliente ?? "Da assegnare"}</td>
                    <td className="px-4 py-3 tabular-nums">{formatData(f.dataEmissione)}</td>
                    <td className="px-4 py-3">
                      <Tag tone={stato?.tone}>{stato?.label ?? f.stato}</Tag>
                    </td>
                    <td className="money px-4 py-3 text-right tabular-nums">
                      {formatEuro(f.totaleCent)}
                    </td>
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

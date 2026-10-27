import { formatEuro } from "@telaio/core";
import { abbonamenti, clientiRef, desc, eq, getDb, isNull, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { AbbonamentoModal } from "@/components/domain/abbonamento-modal";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_ABBONAMENTO } from "@/lib/stati";

export const metadata = { title: "Abbonamenti" };
export const dynamic = "force-dynamic";

export default async function AbbonamentiPage() {
  const db = getDb();
  const [lista, clienti, emittenti] = await Promise.all([
    db
      .select({ a: abbonamenti, cliente: clientiRef.nome, emittente: ragioniSociali.nome })
      .from(abbonamenti)
      .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, abbonamenti.ragioneSocialeId))
      .where(isNull(abbonamenti.deletedAt))
      .orderBy(desc(abbonamenti.createdAt)),
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

  return (
    <>
      <PageHeader
        numero="09"
        sezione="Amministrazione"
        titolo="Abbonamenti"
        descrizione="Canoni mensili, trimestrali, semestrali o annuali che generano rate."
        azione={<AbbonamentoModal clienti={clienti} emittenti={emittenti} />}
      />
      {lista.length === 0 ? (
        <EmptyState title="Nessun abbonamento">
          Crea il primo abbonamento: le rate compaiono nello scadenzario.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Periodicità</th>
                <th className="px-4 py-3 font-medium">Dal</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 text-right font-medium">Rata</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ a, cliente }) => {
                const stato = STATO_ABBONAMENTO[a.stato];
                return (
                  <tr key={a.id} className="border-t border-grey-2/60">
                    <td className="px-4 py-3">
                      <Link
                        href={`/abbonamenti/${a.id}`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.descrizione}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-ink-2">{cliente}</td>
                    <td className="px-4 py-3 capitalize text-ink-2">{a.periodicita}</td>
                    <td className="px-4 py-3 tabular-nums">{formatData(a.inizio)}</td>
                    <td className="px-4 py-3">
                      <Tag tone={stato?.tone}>{stato?.label ?? a.stato}</Tag>
                    </td>
                    <td className="money px-4 py-3 text-right tabular-nums">
                      {formatEuro(a.importoRataCent)}
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

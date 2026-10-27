import { formatEuro } from "@telaio/core";
import { clientiRef, conti, desc, eq, getDb, incassi, isNull } from "@telaio/db";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";

export const metadata = { title: "Incassi" };
export const dynamic = "force-dynamic";

export default async function IncassiPage() {
  const db = getDb();
  const [lista, contiAttivi] = await Promise.all([
    db
      .select({ i: incassi, conto: conti.nome, cliente: clientiRef.nome })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .leftJoin(clientiRef, eq(clientiRef.id, incassi.clienteRefId))
      .where(isNull(incassi.deletedAt))
      .orderBy(desc(incassi.data), desc(incassi.createdAt))
      .limit(200),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);
  const totale = lista.reduce((s, { i }) => s + i.importoCent, 0);

  return (
    <>
      <PageHeader
        numero="07"
        sezione="Amministrazione"
        titolo="Incassi"
        descrizione="Su bonifico, contanti e carta. Ogni incasso genera un'entrata in prima nota."
        azione={<IncassoModal conti={contiAttivi} />}
      />
      {lista.length === 0 ? (
        <EmptyState title="Nessun incasso registrato">
          Registra il primo incasso: aggiornerà scadenzario e prima nota.
        </EmptyState>
      ) : (
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Data</th>
                <th className="px-4 py-3 font-medium">Descrizione</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Conto</th>
                <th className="px-4 py-3 text-right font-medium">Importo</th>
              </tr>
            </thead>
            <tbody>
              {lista.map(({ i, conto, cliente }) => (
                <tr key={i.id} className="border-t border-grey-2/60">
                  <td className="px-4 py-3 tabular-nums">{formatData(i.data)}</td>
                  <td className="px-4 py-3">
                    {i.descrizione ?? "Incasso"}
                    {(i.rataId || i.fatturaId) && (
                      <Tag className="ml-2">{i.fatturaId ? "Fattura" : "Rata"}</Tag>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-2">{cliente ?? "—"}</td>
                  <td className="px-4 py-3 text-ink-2">{conto}</td>
                  <td className="money px-4 py-3 text-right tabular-nums">
                    {formatEuro(i.importoCent)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-grey-2">
                <td colSpan={4} className="px-4 py-3 text-right text-muted">
                  Totale
                </td>
                <td className="money px-4 py-3 text-right font-semibold tabular-nums">
                  {formatEuro(totale)}
                </td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
    </>
  );
}

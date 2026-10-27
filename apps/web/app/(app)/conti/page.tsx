import { formatEuro } from "@telaio/core";
import { conti, eq, getDb, isNull, ragioniSociali } from "@telaio/db";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { saldiConti } from "@/lib/dominio/movimenti";

export const metadata = { title: "Conti" };
export const dynamic = "force-dynamic";

const TIPI = { bonifico: "Conto corrente", contante: "Contanti", carta: "Carta / POS" } as const;

export default async function ContiPage() {
  const db = getDb();
  const [lista, saldi] = await Promise.all([
    db
      .select({ c: conti, rs: ragioniSociali.nome })
      .from(conti)
      .leftJoin(ragioniSociali, eq(ragioniSociali.id, conti.ragioneSocialeId))
      .where(isNull(conti.deletedAt)),
    saldiConti(db),
  ]);
  const totale = [...saldi.values()].reduce((s, v) => s + v, 0);

  return (
    <>
      <PageHeader
        numero="11"
        sezione="Amministrazione"
        titolo="Conti"
        descrizione="Saldo iniziale più i movimenti di prima nota."
      />
      {lista.length === 0 ? (
        <EmptyState title="Nessun conto" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {lista.map(({ c, rs }) => (
            <Card key={c.id}>
              <Tag tone="blue">{TIPI[c.tipo]}</Tag>
              <h2 className="mt-3 font-display text-xl font-semibold">{c.nome}</h2>
              <p className="text-sm text-muted">{rs ?? "Trasversale"}</p>
              <p className="money mt-4 text-3xl font-semibold tabular-nums">
                {formatEuro(saldi.get(c.id) ?? c.saldoInizialeCent)}
              </p>
            </Card>
          ))}
          <div className="ink-panel p-5 sm:p-6">
            <p className="eyebrow !text-grey-2">Totale liquidità</p>
            <p className="money mt-4 text-3xl font-semibold tabular-nums">{formatEuro(totale)}</p>
          </div>
        </div>
      )}
    </>
  );
}

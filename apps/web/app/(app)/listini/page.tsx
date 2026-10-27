import { asc, eq, getDb, isNull, listinoBasi, listinoModuli, listini, moduloBasi, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { Prezzo } from "@/components/domain/prezzo";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { regoleDa } from "@/lib/regole";

export const metadata = { title: "Listini" };
export const dynamic = "force-dynamic";

export default async function ListiniPage() {
  const db = getDb();
  const [elenco, basi, moduli, assegn] = await Promise.all([
    db.select({ l: listini, rs: ragioniSociali }).from(listini).innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId)).where(isNull(listini.deletedAt)).orderBy(asc(listini.createdAt)),
    db.select().from(listinoBasi).where(isNull(listinoBasi.deletedAt)).orderBy(asc(listinoBasi.ordine)),
    db.select().from(listinoModuli).where(isNull(listinoModuli.deletedAt)).orderBy(asc(listinoModuli.ordine)),
    db.select().from(moduloBasi),
  ]);

  return (
    <>
      <PageHeader
        numero="04"
        sezione="Commerciale"
        titolo="Listini"
        descrizione="Consultazione dei listini. Si modificano in Impostazioni."
        azione={<Button asChild variant="ghost"><Link href="/impostazioni/listini">Modifica listini</Link></Button>}
      />
      {elenco.length === 0 && <EmptyState title="Nessun listino" />}
      <div className="flex flex-col gap-4">
        {elenco.map(({ l, rs }) => {
          const regole = regoleDa(rs);
          const b = basi.filter((x) => x.listinoId === l.id);
          const m = moduli.filter((x) => x.listinoId === l.id);
          return (
            <Card key={l.id}>
              <p className="eyebrow">{rs.nome}</p>
              <h2 className="font-display text-2xl font-semibold">{l.nome}</h2>
              {b.length === 0 && m.length === 0 && <p className="mt-3 text-sm text-muted">Listino vuoto.</p>}
              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                {[["Basi", b], ["Moduli", m]].map(([titolo, voci]) => (
                  <div key={titolo as string}>
                    <h3 className="font-display text-lg font-semibold">{titolo as string}</h3>
                    <ul className="mt-2 divide-y divide-grey-2/60">
                      {(voci as typeof b).map((v) => (
                        <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <div>
                            <p className="font-medium">{v.nome}</p>
                            {titolo === "Moduli" && (
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {assegn.filter((a) => a.moduloId === v.id).map((a) => <Tag key={a.baseId}>{b.find((x) => x.id === a.baseId)?.nome}</Tag>)}
                              </div>
                            )}
                          </div>
                          <Prezzo nettoCent={v.unaTantumCent} regole={regole} className="items-end" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

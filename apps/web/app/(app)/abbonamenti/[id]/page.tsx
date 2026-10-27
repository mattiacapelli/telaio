import { formatEuro } from "@telaio/core";
import {
  abbonamenti,
  asc,
  clientiRef,
  conti,
  eq,
  getDb,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_ABBONAMENTO, STATO_RATA } from "@/lib/stati";
import { cambiaStatoAbbonamentoAction } from "../actions";

export const metadata = { title: "Abbonamento" };
export const dynamic = "force-dynamic";

const AZIONI: Record<string, { stato: string; label: string }[]> = {
  attivo: [
    { stato: "sospeso", label: "Sospendi" },
    { stato: "cessato", label: "Cessa" },
  ],
  sospeso: [
    { stato: "attivo", label: "Riattiva" },
    { stato: "cessato", label: "Cessa" },
  ],
  cessato: [],
};

export default async function AbbonamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({ a: abbonamenti, cliente: clientiRef.nome, emittente: ragioniSociali.nome })
    .from(abbonamenti)
    .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
    .innerJoin(ragioniSociali, eq(ragioniSociali.id, abbonamenti.ragioneSocialeId))
    .where(eq(abbonamenti.id, id));
  if (!riga || riga.a.deletedAt) notFound();
  const { a } = riga;
  const [lista, contiAttivi] = await Promise.all([
    db.select().from(rate).where(eq(rate.abbonamentoId, id)).orderBy(asc(rate.scadenza)),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);
  const stato = STATO_ABBONAMENTO[a.stato];

  return (
    <>
      <PageHeader
        numero="09"
        sezione="Abbonamenti"
        titolo={a.descrizione}
        descrizione={`${riga.emittente} · ${riga.cliente} · ${a.periodicita} · ${formatEuro(a.importoRataCent)} a rata`}
        azione={
          <div className="flex items-center gap-2">
            <Tag tone={stato?.tone}>{stato?.label ?? a.stato}</Tag>
            {(AZIONI[a.stato] ?? []).map((az) => (
              <form key={az.stato} action={cambiaStatoAbbonamentoAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="stato" value={az.stato} />
                <Button type="submit" variant="glass" size="sm">
                  {az.label}
                </Button>
              </form>
            ))}
          </div>
        }
      />
      <p className="mb-4 text-sm text-muted">
        Dal {formatData(a.inizio)}
        {a.fine ? ` al ${formatData(a.fine)}` : " · senza scadenza"}. Rate generate fino al{" "}
        {formatData(a.rateGenerateFino)}.{" "}
        <Link href="/scadenzario" className="underline underline-offset-4">
          Vai allo scadenzario
        </Link>
      </p>
      <Card className="overflow-x-auto p-2 sm:p-3">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">N.</th>
              <th className="px-4 py-3 font-medium">Scadenza</th>
              <th className="px-4 py-3 font-medium">Stato</th>
              <th className="px-4 py-3 text-right font-medium">Importo</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {lista.map((r) => {
              const s = STATO_RATA[r.stato];
              const aperta =
                r.stato === "da_incassare" || r.stato === "scaduta" || r.stato === "parziale";
              return (
                <tr key={r.id} className="border-t border-grey-2/60">
                  <td className="px-4 py-3 tabular-nums">{r.numero}</td>
                  <td className="px-4 py-3 tabular-nums">{formatData(r.scadenza)}</td>
                  <td className="px-4 py-3">
                    <Tag tone={s?.tone}>{s?.label ?? r.stato}</Tag>
                  </td>
                  <td className="money px-4 py-3 text-right tabular-nums">
                    {formatEuro(r.importoCent)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {aperta && (
                      <IncassoModal
                        conti={contiAttivi}
                        rataId={r.id}
                        importoCent={r.importoCent}
                        descrizione={r.descrizione}
                        trigger="Incassa"
                        triggerVariant="glass"
                        triggerSize="sm"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}

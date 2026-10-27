import { formatAliquota, formatEuro, type RegoleFiscali } from "@telaio/core";
import {
  asc,
  conti,
  eq,
  fatturaRighe,
  fatture,
  getDb,
  incassi,
  isNull,
  preventivi,
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Prezzo } from "@/components/domain/prezzo";
import { Button } from "@/components/ui/button";
import { Card, InkPanel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_FATTURA } from "@/lib/stati";
import { emettiFatturaAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function FatturaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [f] = await db.select().from(fatture).where(eq(fatture.id, id));
  if (!f || f.deletedAt) notFound();
  const [righe, versati, contiAttivi, prev] = await Promise.all([
    db
      .select()
      .from(fatturaRighe)
      .where(eq(fatturaRighe.fatturaId, id))
      .orderBy(asc(fatturaRighe.posizione)),
    db.select().from(incassi).where(eq(incassi.fatturaId, id)),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
    f.preventivoId
      ? db
          .select({ id: preventivi.id, numero: preventivi.numero, oggetto: preventivi.oggetto })
          .from(preventivi)
          .where(eq(preventivi.id, f.preventivoId))
      : Promise.resolve([]),
  ]);

  const regole = f.snapshot.regole as unknown as RegoleFiscali;
  const emittente = (f.snapshot.emittente as { nome?: string }).nome ?? "";
  const cliente = (f.snapshot.cliente as { nome?: string }).nome;
  const stato = STATO_FATTURA[f.stato];
  const incassato = versati.filter((v) => !v.deletedAt).reduce((s, v) => s + v.importoCent, 0);
  const residuo = Math.max(0, f.nettoDaPagareCent - incassato);
  const emessa = f.stato !== "bozza";

  return (
    <>
      <PageHeader
        numero="06"
        sezione="Fatture"
        titolo={f.numero ?? "Fattura in bozza"}
        descrizione={`${emittente} · ${cliente ?? "cliente da assegnare"}${prev[0] ? ` · da preventivo ${prev[0].numero ?? prev[0].oggetto}` : ""}`}
        azione={<Tag tone={stato?.tone}>{stato?.label ?? f.stato}</Tag>}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex flex-col gap-4">
          <Card className="overflow-x-auto p-2 sm:p-3">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="text-left text-xs text-muted">
                  <th className="px-4 py-3 font-medium">Descrizione</th>
                  <th className="px-4 py-3 text-right font-medium">Importo</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => (
                  <tr key={r.id} className="border-t border-grey-2/60">
                    <td className="px-4 py-3">{r.descrizione}</td>
                    <td className="px-4 py-3 text-right">
                      <Prezzo nettoCent={r.importoCent} regole={regole} className="items-end" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          {emessa && (
            <Card>
              <h2 className="font-display text-xl font-semibold">Pagamenti</h2>
              <p className="mt-1 text-sm text-muted">Scadenza {formatData(f.scadenza)}</p>
              <ul className="mt-3 text-sm">
                {versati
                  .filter((v) => !v.deletedAt)
                  .map((v) => (
                    <li
                      key={v.id}
                      className="flex justify-between border-t border-grey-2/60 py-2 first:border-t-0"
                    >
                      <span>
                        {formatData(v.data)} · {v.descrizione ?? "Incasso"}
                      </span>
                      <span className="tabular-nums">{formatEuro(v.importoCent)}</span>
                    </li>
                  ))}
                {versati.length === 0 && <li className="text-muted">Nessun incasso ancora.</li>}
              </ul>
            </Card>
          )}
        </div>
        <InkPanel>
          <p className="eyebrow !text-grey-2">Totali</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <dt>Imponibile</dt>
              <dd>{formatEuro(f.imponibileCent)}</dd>
            </div>
            {regole.ivaAttiva && (
              <div className="flex justify-between">
                <dt>IVA {formatAliquota(regole.aliquotaIvaBp)}</dt>
                <dd>{formatEuro(f.ivaCent)}</dd>
              </div>
            )}
            {f.bolloCent > 0 && (
              <div className="flex justify-between">
                <dt>Bollo</dt>
                <dd>{formatEuro(f.bolloCent)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
              <dt>Totale</dt>
              <dd className="money text-3xl font-semibold">{formatEuro(f.totaleCent)}</dd>
            </div>
            {f.ritenutaCent > 0 && (
              <div className="flex justify-between">
                <dt>Ritenuta</dt>
                <dd>−{formatEuro(f.ritenutaCent)}</dd>
              </div>
            )}
            {f.ivaSplitCent > 0 && (
              <div className="flex justify-between">
                <dt>IVA in split payment</dt>
                <dd>−{formatEuro(f.ivaSplitCent)}</dd>
              </div>
            )}
            {f.nettoDaPagareCent !== f.totaleCent && (
              <div className="flex justify-between font-semibold">
                <dt>Netto da incassare</dt>
                <dd>{formatEuro(f.nettoDaPagareCent)}</dd>
              </div>
            )}
          </dl>
          {!regole.ivaAttiva && regole.diciturSenzaIva && (
            <p className="mt-3 text-xs text-grey-2">
              {regole.naturaSenzaIva} · {regole.diciturSenzaIva}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-3">
            {f.stato === "bozza" && (
              <form action={emettiFatturaAction}>
                <input type="hidden" name="id" value={f.id} />
                <Button type="submit" className="w-full bg-paper text-ink hover:bg-white">
                  Emetti fattura
                </Button>
                <p className="mt-2 text-center text-xs text-grey-2">
                  Assegna il numero e congela i dati: non si modifica più.
                </p>
              </form>
            )}
            {emessa && residuo > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-center text-sm">Residuo {formatEuro(residuo)}</p>
                <IncassoModal
                  conti={contiAttivi}
                  fatturaId={f.id}
                  rataId={f.rataId ?? undefined}
                  importoCent={residuo}
                  descrizione={`Incasso fattura ${f.numero}`}
                  triggerVariant="glass"
                />
              </div>
            )}
            {prev[0] && (
              <Button
                asChild
                variant="ghost"
                className="border-white/30 text-paper hover:bg-white/10"
              >
                <Link href={`/preventivi/${prev[0].id}`}>Vai al preventivo</Link>
              </Button>
            )}
          </div>
        </InkPanel>
      </div>
    </>
  );
}

import {
  formatAliquota,
  formatEuro,
  type RegoleFiscali,
  type StatoPreventivo,
  transizioniPreventivo,
} from "@telaio/core";
import { asc, eq, getDb, preventivi, preventivoRighe } from "@telaio/db";
import { notFound } from "next/navigation";
import { creaFatturaDaPreventivoAction } from "@/app/(app)/fatture/actions";
import { Prezzo } from "@/components/domain/prezzo";
import { Button } from "@/components/ui/button";
import { Card, InkPanel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { STATO_PREVENTIVO } from "@/lib/stati";
import { cambiaStatoPreventivoAction } from "./actions";

export const dynamic = "force-dynamic";

const AZIONE_STATO: Record<string, string> = {
  inviato: "Segna come inviato",
  in_revisione: "Metti in revisione",
  accettato: "Segna come accettato",
  rifiutato: "Segna come rifiutato",
  scaduto: "Segna come scaduto",
};

const TIPO = {
  una_tantum: "Una tantum",
  canone_annuo: "Canone annuo",
  canone_mensile: "Canone mensile",
} as const;

export default async function PreventivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [p] = await db.select().from(preventivi).where(eq(preventivi.id, id));
  if (!p) notFound();
  const righe = await db
    .select()
    .from(preventivoRighe)
    .where(eq(preventivoRighe.preventivoId, id))
    .orderBy(asc(preventivoRighe.posizione));

  const regole = p.snapshot.regole as unknown as RegoleFiscali;
  const stato = STATO_PREVENTIVO[p.stato];
  const cliente = (p.snapshot.cliente as { nome?: string }).nome;
  const somma = (tipo: keyof typeof TIPO) =>
    righe.filter((r) => r.tipo === tipo).reduce((s, r) => s + r.importoCent, 0);

  return (
    <>
      <PageHeader
        numero="03"
        sezione="Preventivi"
        titolo={p.oggetto}
        descrizione={`${(p.snapshot.emittente as { nome?: string }).nome ?? ""} · ${cliente ?? "cliente da assegnare"}`}
        azione={<Tag tone={stato?.tone}>{stato?.label ?? p.stato}</Tag>}
      />
      <div className="mb-6 flex flex-wrap gap-3">
        {transizioniPreventivo(p.stato as StatoPreventivo).map((nuovo) => (
          <form key={nuovo} action={cambiaStatoPreventivoAction}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="stato" value={nuovo} />
            <Button
              type="submit"
              variant={nuovo === "rifiutato" || nuovo === "scaduto" ? "ghost" : "primary"}
            >
              {AZIONE_STATO[nuovo]}
            </Button>
          </form>
        ))}
        {p.stato === "accettato" && (
          <form action={creaFatturaDaPreventivoAction}>
            <input type="hidden" name="preventivoId" value={p.id} />
            <Button type="submit">Crea fattura</Button>
          </form>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="overflow-x-auto p-2 sm:p-3">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="px-4 py-3 font-medium">Voce</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 text-right font-medium">Importo</th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.id} className="border-t border-grey-2/60">
                  <td className="px-4 py-3">{r.descrizione}</td>
                  <td className="px-4 py-3 text-ink-2">{TIPO[r.tipo]}</td>
                  <td className="px-4 py-3 text-right">
                    <Prezzo nettoCent={r.importoCent} regole={regole} className="items-end" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <InkPanel>
          <p className="eyebrow !text-grey-2">Totali</p>
          <dl className="mt-4 flex flex-col gap-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <dt>Imponibile una tantum</dt>
              <dd>{formatEuro(p.imponibileCent)}</dd>
            </div>
            {regole.ivaAttiva && (
              <div className="flex justify-between">
                <dt>IVA {formatAliquota(regole.aliquotaIvaBp)}</dt>
                <dd>{formatEuro(p.ivaCent)}</dd>
              </div>
            )}
            {p.bolloCent > 0 && (
              <div className="flex justify-between">
                <dt>Bollo</dt>
                <dd>{formatEuro(p.bolloCent)}</dd>
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-white/20 pt-3">
              <dt>Totale</dt>
              <dd className="money text-3xl font-semibold">{formatEuro(p.totaleCent)}</dd>
            </div>
          </dl>
          {!regole.ivaAttiva && regole.diciturSenzaIva && (
            <p className="mt-3 text-xs text-grey-2">{regole.diciturSenzaIva}</p>
          )}
          <div className="mt-5 flex flex-col gap-1 border-t border-white/20 pt-4 text-sm tabular-nums">
            <div className="flex justify-between">
              <span>Canone annuo</span>
              <span>{formatEuro(somma("canone_annuo"))}</span>
            </div>
            <div className="flex justify-between">
              <span>Canone mensile</span>
              <span>{formatEuro(somma("canone_mensile"))}</span>
            </div>
          </div>
        </InkPanel>
      </div>
    </>
  );
}

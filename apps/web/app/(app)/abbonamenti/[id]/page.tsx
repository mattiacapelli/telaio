import {
  formatAliquota,
  formatEuro,
  MESI_PER_PERIODICITA,
  type Periodicita,
  prezzoVisualizzato,
} from "@telaio/core";
import {
  abbonamenti,
  asc,
  clientiRef,
  conti,
  eq,
  fatture,
  getDb,
  incassi,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { Table, Td, Th } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { regoleDa } from "@/lib/regole";
import { STATO_ABBONAMENTO, STATO_RATA } from "@/lib/stati";
import { cambiaStatoAbbonamentoAction } from "../actions";

export const metadata = { title: "Abbonamento" };
export const dynamic = "force-dynamic";

const PERIODI: Record<string, string> = {
  mensile: "Mensile",
  trimestrale: "Trimestrale",
  semestrale: "Semestrale",
  annuale: "Annuale",
};
const AZIONI: Record<string, { stato: string; label: string; pericolosa?: boolean }[]> = {
  attivo: [
    { stato: "sospeso", label: "Sospendi" },
    { stato: "cessato", label: "Disdici", pericolosa: true },
  ],
  sospeso: [
    { stato: "attivo", label: "Riattiva" },
    { stato: "cessato", label: "Disdici", pericolosa: true },
  ],
  cessato: [],
};

export default async function AbbonamentoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [riga] = await db
    .select({ a: abbonamenti, cliente: clientiRef, rs: ragioniSociali })
    .from(abbonamenti)
    .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
    .innerJoin(ragioniSociali, eq(ragioniSociali.id, abbonamenti.ragioneSocialeId))
    .where(eq(abbonamenti.id, id));
  if (!riga || riga.a.deletedAt) notFound();
  const { a, cliente, rs } = riga;
  const dataOggi = oggi();
  const [lista, contiAttivi, versati] = await Promise.all([
    db
      .select({ r: rate, fattura: fatture.numero })
      .from(rate)
      .leftJoin(fatture, eq(fatture.id, rate.fatturaId))
      .where(eq(rate.abbonamentoId, id))
      .orderBy(asc(rate.scadenza)),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
    db
      .select({ i: incassi })
      .from(incassi)
      .innerJoin(rate, eq(rate.id, incassi.rataId))
      .where(eq(rate.abbonamentoId, id)),
  ]);

  const regole = regoleDa(rs);
  const v = prezzoVisualizzato(a.importoRataCent, regole);
  const annuo = Math.round(
    (a.importoRataCent * 12) / MESI_PER_PERIODICITA[a.periodicita as Periodicita],
  );
  const annuoV = prezzoVisualizzato(annuo, regole);
  const incassato = versati.reduce((s, { i }) => s + i.importoCent, 0);
  const pagate = lista.filter(({ r }) => r.stato === "incassata").length;
  const prossima = lista.find(({ r }) => r.scadenza >= dataOggi && r.stato === "da_incassare")?.r;
  const stato = STATO_ABBONAMENTO[a.stato];
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "senza IVA";
  const cronologia = [
    ...versati.map(({ i }) => ({
      d: i.data,
      t: `Incasso registrato · ${formatEuro(i.importoCent)}`,
    })),
    { d: a.createdAt.toISOString().slice(0, 10), t: "Abbonamento creato" },
  ].sort((x, y) => (x.d < y.d ? 1 : -1));

  return (
    <>
      <PageHeader
        titolo={cliente.nome}
        descrizione={`${a.descrizione} · ${PERIODI[a.periodicita]} · ${rs.nome} · ${iva}`}
        stato={
          <Tag tone={a.stato === "attivo" ? "green" : "orange"}>{stato?.label ?? a.stato}</Tag>
        }
        azioni={
          <>
            {cliente.twentyCompanyId && (
              <Button asChild variant="secondary">
                <Link href={`/clienti/${cliente.twentyCompanyId}`}>Scheda cliente</Link>
              </Button>
            )}
            {(AZIONI[a.stato] ?? []).map((az) => (
              <form key={az.stato} action={cambiaStatoAbbonamentoAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="stato" value={az.stato} />
                <Button type="submit" variant={az.pericolosa ? "danger" : "secondary"}>
                  {az.label}
                </Button>
              </form>
            ))}
          </>
        }
      />
      <p className="-mt-4 text-sm text-fg-2">
        Sospendere o disdire annulla le rate future ancora da incassare; riattivando tornano da
        incassare e si rigenerano quelle mancanti.
      </p>

      <StatsRow
        dati={[
          {
            etichetta: "Rata netta",
            valore: formatEuro(a.importoRataCent),
            nota: PERIODI[a.periodicita]?.toLowerCase(),
          },
          {
            etichetta: "Rata con IVA",
            valore: v.lordoCent !== null ? formatEuro(v.lordoCent) : "—",
            nota: v.ivaCent !== null ? `${iva} ${formatEuro(v.ivaCent)}` : "senza IVA",
          },
          {
            etichetta: "Valore annuo",
            valore: formatEuro(annuo),
            nota:
              annuoV.lordoCent !== null ? `${formatEuro(annuoV.lordoCent)} con IVA` : "senza IVA",
          },
          {
            etichetta: "Incassato finora",
            valore: formatEuro(incassato),
            nota: `${pagate} rat${pagate === 1 ? "a pagata" : "e pagate"}`,
          },
          {
            etichetta: "Prossima rata",
            valore: prossima ? formatData(prossima.scadenza).slice(0, 5) : "—",
            nota: prossima ? formatEuro(prossima.importoCent) : "nessuna in programma",
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <h2 className="text-base font-semibold">Rate</h2>
          <Table minLarghezza={560}>
            <thead>
              <tr>
                <Th>Scadenza</Th>
                <Th>N.</Th>
                <Th>Fattura</Th>
                <Th destra>Importo</Th>
                <Th>Stato</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lista.map(({ r, fattura }) => {
                const s = STATO_RATA[r.stato];
                const aperta = ["da_incassare", "scaduta", "parziale"].includes(r.stato);
                const rv = prezzoVisualizzato(r.importoCent, regole);
                return (
                  <tr key={r.id} className="group">
                    <Td className="tabular-nums">{formatData(r.scadenza)}</Td>
                    <Td className="tabular-nums text-fg-2">{r.numero}</Td>
                    <Td className="text-fg-2">{fattura ?? "—"}</Td>
                    <Td destra>
                      <div className="flex flex-col items-end leading-tight">
                        <span className="font-medium">
                          {formatEuro(rv.lordoCent ?? r.importoCent)}
                        </span>
                        {rv.lordoCent !== null && (
                          <span className="text-xs text-fg-3">
                            {formatEuro(r.importoCent)} + IVA {formatEuro(rv.ivaCent ?? 0)}
                          </span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <Tag tone={s?.tone}>{s?.label ?? r.stato}</Tag>
                    </Td>
                    <Td destra>
                      {aperta && (
                        <IncassoModal
                          conti={contiAttivi}
                          rataId={r.id}
                          importoCent={r.importoCent}
                          descrizione={r.descrizione}
                          trigger="Incassa"
                          triggerVariant="secondary"
                          triggerSize="sm"
                        />
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader
              title="Piano"
              description={`Dal ${formatData(a.inizio)}${a.fine ? ` al ${formatData(a.fine)}` : " · senza scadenza"}`}
            />
            <div className="flex items-start justify-between gap-3 text-sm">
              <span className="flex flex-col leading-tight">
                <b className="font-medium">{a.descrizione}</b>
                <span className="text-xs text-fg-3">{PERIODI[a.periodicita]?.toLowerCase()}</span>
              </span>
              <span className="text-right tabular-nums">
                {formatEuro(v.nettoCent)}
                {v.lordoCent !== null && (
                  <span className="block text-xs text-fg-3">{formatEuro(v.lordoCent)} con IVA</span>
                )}
              </span>
            </div>
          </Card>
          <Card>
            <CardHeader title="Cronologia" />
            <ul className="divide-y divide-line text-sm">
              {cronologia.map((c, i) => (
                <li key={`${c.d}-${i}`} className="flex gap-3 py-2">
                  <span className="shrink-0 text-fg-3 tabular-nums">{formatData(c.d)}</span>
                  <span>{c.t}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}

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
import { ModificaDataIncasso, ModificaDateFattura } from "@/components/domain/modifica-date";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { DefList } from "@/components/ui/def-list";
import { Input } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { Table, Td, Th } from "@/components/ui/table";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { STATO_FATTURA } from "@/lib/stati";
import { emettiFatturaAction } from "../actions";

export const metadata = { title: "Fattura" };
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
  const cliente = f.snapshot.cliente as {
    nome?: string;
    partitaIva?: string;
    codiceFiscale?: string;
    codiceSdi?: string;
    pec?: string;
  };
  const stato = STATO_FATTURA[f.stato];
  const incassato = versati.filter((v) => !v.deletedAt).reduce((s, v) => s + v.importoCent, 0);
  const residuo = Math.max(0, f.nettoDaPagareCent - incassato);
  const emessa = f.stato !== "bozza";

  return (
    <>
      <PageHeader
        titolo={f.numero ?? "Fattura in bozza"}
        descrizione={`${emittente} · ${cliente.nome ?? "cliente da assegnare"}${prev[0] ? ` · da preventivo ${prev[0].numero ?? prev[0].oggetto}` : ""}`}
        stato={<Tag tone={stato?.tone}>{stato?.label ?? f.stato}</Tag>}
        azioni={
          <>
            <Button asChild variant="secondary">
              <a href={`/api/pdf/fatture/${f.id}`}>Scarica PDF</a>
            </Button>
            {prev[0] && (
              <Button asChild variant="secondary">
                <Link href={`/preventivi/${prev[0].id}`}>Preventivo</Link>
              </Button>
            )}
            {!emessa && (
              <form action={emettiFatturaAction} className="flex items-center gap-2">
                <input type="hidden" name="id" value={f.id} />
                <Input
                  type="date"
                  name="dataEmissione"
                  defaultValue={oggi()}
                  required
                  aria-label="Data di emissione"
                  className="w-auto"
                />
                <Button type="submit">Emetti fattura</Button>
              </form>
            )}
            {emessa && f.dataEmissione && f.scadenza && (
              <ModificaDateFattura
                fattura={{
                  id: f.id,
                  anno: f.anno,
                  dataEmissione: f.dataEmissione,
                  scadenza: f.scadenza,
                }}
              />
            )}
            {emessa && residuo > 0 && (
              <IncassoModal
                conti={contiAttivi}
                fatturaId={f.id}
                importoCent={residuo}
                descrizione={`Incasso fattura ${f.numero}`}
                trigger="Registra incasso"
              />
            )}
          </>
        }
      />
      {!emessa && (
        <p className="-mt-4 text-sm text-fg-2">
          Emettendo la fattura assegni il numero, congeli i dati e la rata entra nello scadenzario:
          poi non si modifica più. La data di emissione la scegli tu (il numero segue l&apos;anno di
          quella data); emissione e scadenza si potranno ritoccare anche dopo.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Table>
            <thead>
              <tr>
                <Th>Descrizione</Th>
                <Th destra>Qtà</Th>
                <Th destra>Prezzo</Th>
                <Th destra>Importo</Th>
              </tr>
            </thead>
            <tbody>
              {righe.map((r) => (
                <tr key={r.id} className="group">
                  <Td>{r.descrizione}</Td>
                  <Td destra>{r.quantita}</Td>
                  <Td destra>{formatEuro(r.prezzoUnitarioCent)}</Td>
                  <Td destra className="font-medium">
                    {formatEuro(r.importoCent)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <Card>
            <CardHeader
              title="Incassi"
              description={versati.length ? `${formatEuro(incassato)} incassati` : undefined}
            />
            {versati.filter((v) => !v.deletedAt).length === 0 ? (
              <p className="text-sm text-fg-2">Nessun incasso ancora.</p>
            ) : (
              <ul className="divide-y divide-line text-sm">
                {versati
                  .filter((v) => !v.deletedAt)
                  .map((v) => (
                    <li key={v.id} className="flex justify-between gap-3 py-2">
                      <span>
                        {formatData(v.data)} · {v.descrizione ?? "Incasso"}
                      </span>
                      <span className="flex items-center gap-2">
                        <ModificaDataIncasso
                          incasso={{ id: v.id, data: v.data }}
                          trigger="Modifica data"
                        />
                        <span className="font-medium tabular-nums">
                          {formatEuro(v.importoCent)}
                        </span>
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Totali" />
            <DefList
              voci={[
                { etichetta: "Imponibile", valore: formatEuro(f.imponibileCent), numerico: true },
                ...(regole.ivaAttiva
                  ? [
                      {
                        etichetta: `IVA ${formatAliquota(regole.aliquotaIvaBp)}`,
                        valore: formatEuro(f.ivaCent),
                        numerico: true,
                      },
                    ]
                  : []),
                ...(f.bolloCent > 0
                  ? [{ etichetta: "Bollo", valore: formatEuro(f.bolloCent), numerico: true }]
                  : []),
                {
                  etichetta: "Totale documento",
                  valore: <b className="text-base">{formatEuro(f.totaleCent)}</b>,
                  numerico: true,
                },
                ...(f.ritenutaCent > 0
                  ? [
                      {
                        etichetta: "Ritenuta d'acconto",
                        valore: `− ${formatEuro(f.ritenutaCent)}`,
                        numerico: true,
                      },
                    ]
                  : []),
                ...(f.ivaSplitCent > 0
                  ? [
                      {
                        etichetta: "IVA in split payment",
                        valore: `− ${formatEuro(f.ivaSplitCent)}`,
                        numerico: true,
                      },
                    ]
                  : []),
                ...(f.nettoDaPagareCent !== f.totaleCent
                  ? [
                      {
                        etichetta: "Netto da incassare",
                        valore: formatEuro(f.nettoDaPagareCent),
                        numerico: true,
                      },
                    ]
                  : []),
              ]}
            />
            {!regole.ivaAttiva && regole.diciturSenzaIva && (
              <p className="mt-3 text-xs text-fg-2">{regole.diciturSenzaIva}</p>
            )}
            {emessa && (
              <p className="mt-3 border-t border-line pt-3 text-sm">
                Residuo da incassare:{" "}
                <b className="font-semibold tabular-nums">{formatEuro(residuo)}</b>
              </p>
            )}
          </Card>
          <Card>
            <CardHeader title="Intestatario" />
            <DefList
              voci={[
                { etichetta: "Nome", valore: cliente.nome ?? "—" },
                { etichetta: "P.IVA", valore: cliente.partitaIva ?? "—", numerico: true },
                {
                  etichetta: "Codice fiscale",
                  valore: cliente.codiceFiscale ?? "—",
                  numerico: true,
                },
                { etichetta: "Codice SDI", valore: cliente.codiceSdi ?? "—", numerico: true },
                ...(emessa
                  ? [
                      {
                        etichetta: "Emessa il",
                        valore: formatData(f.dataEmissione),
                        numerico: true,
                      },
                      { etichetta: "Scadenza", valore: formatData(f.scadenza), numerico: true },
                    ]
                  : []),
              ]}
            />
          </Card>
        </div>
      </div>
    </>
  );
}

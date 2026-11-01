import { formatEuro } from "@telaio/core";
import {
  and,
  clientiRef,
  desc,
  eq,
  fatturaRighe,
  fatture,
  getDb,
  isNull,
  ragioniSociali,
  rate,
  sql,
} from "@telaio/db";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatsRow } from "@/components/ui/stats";
import { formatData, oggi } from "@/lib/date";
import { FattureTabella, type RigaFattura } from "./fatture-tabella";

export const metadata = { title: "Fatture" };
export const dynamic = "force-dynamic";

const SDI: Record<string, string> = {
  bozza: "Bozza",
  emessa: "Emessa",
  inviata_sdi: "Inviata",
  consegnata: "Consegnata",
  scartata: "Scartata",
  parzialmente_pagata: "Emessa",
  pagata: "Emessa",
};
const PAGAMENTO: Record<string, string> = {
  nessuno: "—",
  pagata: "Pagata",
  scaduta: "Scaduta",
  parziale: "Parziale",
  da_incassare: "Da incassare",
};

function pagamento(stato: string, rataStato: string | null) {
  if (stato === "bozza") return "nessuno";
  if (stato === "pagata" || rataStato === "incassata") return "pagata";
  if (rataStato === "scaduta") return "scaduta";
  if (stato === "parzialmente_pagata" || rataStato === "parziale") return "parziale";
  return "da_incassare";
}

export default async function FatturePage() {
  const db = getDb();
  const dataOggi = oggi();
  const [emittenti, tutte, daFatturare] = await Promise.all([
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        f: fatture,
        emittente: ragioniSociali.nome,
        cliente: clientiRef.nome,
        causale: sql<
          string | null
        >`(select descrizione from ${fatturaRighe} where ${fatturaRighe.fatturaId} = ${fatture.id} order by posizione limit 1)`,
        rataStato: sql<
          string | null
        >`(select stato from ${rate} where ${rate.id} = ${fatture.rataId})`,
      })
      .from(fatture)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, fatture.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, fatture.clienteRefId))
      .where(isNull(fatture.deletedAt))
      .orderBy(desc(fatture.createdAt))
      .limit(500),
    db
      .select({ r: rate, cliente: clientiRef.nome })
      .from(rate)
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(and(isNull(rate.fatturaId), eq(rate.stato, "da_incassare"), isNull(rate.preventivoId)))
      .orderBy(rate.scadenza)
      .limit(3),
  ]);

  const emesse = tutte.filter(({ f }) => f.stato !== "bozza");
  const imponibile = emesse.reduce((s, { f }) => s + f.imponibileCent, 0);
  const totale = emesse.reduce((s, { f }) => s + f.totaleCent, 0);
  const iva = emesse.reduce((s, { f }) => s + f.ivaCent, 0);
  const aperte = emesse.filter(
    ({ rataStato }) => rataStato && rataStato !== "incassata" && rataStato !== "annullata",
  );
  const nonPagate = aperte.reduce((s, { f }) => s + f.nettoDaPagareCent, 0);
  const scadute = aperte.filter(({ rataStato }) => rataStato === "scaduta").length;
  const scartate = tutte.filter(({ f }) => f.stato === "scartata").length;

  const righe: RigaFattura[] = tutte.map(({ f, emittente, cliente, causale, rataStato }) => {
    const pag = pagamento(f.stato, rataStato);
    return {
      id: f.id,
      numero: f.numero,
      data: f.dataEmissione,
      cliente: cliente ?? (f.snapshot.cliente as { nome?: string } | undefined)?.nome ?? "—",
      causale,
      emittente,
      imponibileCent: f.imponibileCent,
      ivaCent: f.ivaCent,
      bolloCent: f.bolloCent,
      totaleCent: f.totaleCent,
      sdi: f.stato === "parzialmente_pagata" || f.stato === "pagata" ? "emessa" : f.stato,
      etichettaSdi: SDI[f.stato] ?? f.stato,
      pagamento: pag,
      etichettaPagamento: PAGAMENTO[pag] ?? pag,
    };
  });

  return (
    <>
      <PageHeader
        titolo="Fatture"
        descrizione="Da un preventivo accettato oppure libere. L'invio allo SDI passa dall'intermediario, ancora da collegare."
        azioni={
          <>
            <Button asChild variant="secondary">
              <Link href="/report">Export commercialista</Link>
            </Button>
            <Button asChild>
              <Link href="/fatture/nuova">Fattura libera</Link>
            </Button>
          </>
        }
      />
      <StatsRow
        dati={[
          {
            etichetta: "Emesso netto",
            valore: formatEuro(imponibile),
            nota: `${formatEuro(totale)} totale documenti`,
          },
          { etichetta: "IVA a debito", valore: formatEuro(iva), nota: "sulle fatture emesse" },
          {
            etichetta: "Non pagate",
            valore: formatEuro(nonPagate),
            nota:
              scadute > 0
                ? `${scadute} scadut${scadute === 1 ? "a" : "e"}, vedi scadenzario`
                : "nessuna scaduta",
            href: scadute > 0 ? "/scadenzario" : undefined,
            tono: scadute > 0 ? "bad" : undefined,
          },
          { etichetta: "Scartate SDI", valore: scartate, nota: "da correggere e reinviare" },
        ]}
      />
      {daFatturare.length > 0 && (
        <Card>
          <CardHeader title="Da fatturare" description="Rate e canoni in arrivo senza fattura" />
          <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-3">
            {daFatturare.map(({ r, cliente }) => (
              <div key={r.id} className="flex flex-col gap-0.5 bg-surface p-3">
                <span className="text-xs font-medium text-fg-3">
                  {r.scadenza <= dataOggi ? "Scaduta" : `Entro il ${formatData(r.scadenza)}`}
                </span>
                <span className="text-sm font-medium">{cliente ?? "—"}</span>
                <span className="truncate text-xs text-fg-2">{r.descrizione}</span>
                <span className="mt-1 text-base font-semibold tabular-nums">
                  {formatEuro(r.importoCent)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
      <FattureTabella righe={righe} emittenti={emittenti.map((e) => e.nome)} />
    </>
  );
}

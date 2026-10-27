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
import { Card, EmptyState, InkPanel } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { STATO_FATTURA } from "@/lib/stati";
import { cn } from "@/lib/utils";

export const metadata = { title: "Fatture" };
export const dynamic = "force-dynamic";

const SDI: Record<string, { label: string; dot: string }> = {
  bozza: { label: "Bozza", dot: "#969184" },
  emessa: { label: "Emessa", dot: "#2b5ea7" },
  inviata_sdi: { label: "Inviata", dot: "#2b5ea7" },
  consegnata: { label: "Consegnata", dot: "#17150f" },
  scartata: { label: "Scartata", dot: "#b4532a" },
  parzialmente_pagata: { label: "Emessa", dot: "#2b5ea7" },
  pagata: { label: "Emessa", dot: "#2b5ea7" },
};

export default async function FatturePage({
  searchParams,
}: {
  searchParams: Promise<{ em?: string }>;
}) {
  const { em } = await searchParams;
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
      .limit(200),
    db
      .select({ r: rate, cliente: clientiRef.nome })
      .from(rate)
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(and(isNull(rate.fatturaId), eq(rate.stato, "da_incassare"), isNull(rate.preventivoId)))
      .orderBy(rate.scadenza)
      .limit(3),
  ]);

  const mostrate = em ? tutte.filter(({ f }) => f.ragioneSocialeId === em) : tutte;
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

  return (
    <>
      <PageHeader
        numero="06"
        sezione="Fatture"
        titolo="Fatture"
        descrizione="Nascono da preventivi accettati, rate e canoni, oppure le scrivi da zero come fattura libera. Ogni ragione sociale ha il suo sezionale, la sua aliquota e le sue regole; l'invio allo SDI passa dall'intermediario."
      />

      <Card className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] p-0 sm:p-0">
        <Kpi etichetta="Emesso netto" valore={formatEuro(imponibile)}>
          <span className="text-[13px] text-ink-2">{formatEuro(totale)} totale documenti</span>
        </Kpi>
        <Kpi etichetta="IVA a debito" valore={formatEuro(iva)}>
          <span className="text-[13px] text-ink-2">sulle fatture emesse</span>
        </Kpi>
        <Kpi etichetta="Non pagate" valore={formatEuro(nonPagate)}>
          {scadute > 0 ? (
            <Link
              href="/scadenzario"
              className="text-[13px] font-medium text-orange-2 underline underline-offset-[3px]"
            >
              {scadute} scadut{scadute === 1 ? "a" : "e"}, vedi scadenzario
            </Link>
          ) : (
            <span className="text-[13px] text-ink-2">nessuna scaduta</span>
          )}
        </Kpi>
        <Kpi etichetta="Scartate SDI" valore={String(scartate)} ultimo>
          <span className="text-[13px] text-ink-2">da correggere e reinviare</span>
        </Kpi>
      </Card>

      {daFatturare.length > 0 && (
        <InkPanel className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-[22px] font-medium tracking-[-0.015em]">
              Da fatturare
            </h2>
            <span className="text-[13px] text-paper/75">rate e canoni in arrivo senza fattura</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] border-t border-paper/16">
            {daFatturare.map(({ r, cliente }) => (
              <div key={r.id} className="flex flex-col gap-1.5 pt-[18px] pr-5 pb-1">
                <span className="text-[11px] font-medium tracking-[0.14em] text-paper/70 uppercase">
                  {r.scadenza <= dataOggi ? "Scaduta" : `Entro il ${formatData(r.scadenza)}`}
                </span>
                <span className="font-semibold">{cliente ?? "—"}</span>
                <span className="text-[13px] text-paper/78">{r.descrizione}</span>
                <b className="money text-[22px] font-semibold">{formatEuro(r.importoCent)}</b>
              </div>
            ))}
          </div>
        </InkPanel>
      )}

      <Card className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2.5">
          <div role="group" aria-label="Filtra per emittente" className="flex flex-wrap gap-2">
            <Chip href="/fatture" attivo={!em} etichetta="Tutte" n={tutte.length} />
            {emittenti.map((e) => (
              <Chip
                key={e.id}
                href={`/fatture?em=${e.id}`}
                attivo={em === e.id}
                etichetta={e.nome}
                n={tutte.filter(({ f }) => f.ragioneSocialeId === e.id).length}
              />
            ))}
          </div>
          <span className="text-[13px] text-muted">
            Invio SDI tramite intermediario (da collegare)
          </span>
        </div>
        {mostrate.length === 0 ? (
          <EmptyState title="Nessuna fattura">
            Accetta un preventivo e usa «Crea fattura», oppure scrivine una libera.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="text-left">
                  <th>Numero</th>
                  <th>Cliente</th>
                  <th>Emittente</th>
                  <th className="text-right">Imponibile</th>
                  <th className="text-right">IVA</th>
                  <th className="text-right">Totale</th>
                  <th>SDI</th>
                  <th>Pagamento</th>
                  <th>
                    <span className="sr-only">Azioni</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mostrate.map(({ f, emittente, cliente, causale, rataStato }) => {
                  const sdi = SDI[f.stato] ?? SDI.bozza;
                  const cl =
                    cliente ?? (f.snapshot.cliente as { nome?: string } | undefined)?.nome ?? "—";
                  const pag = pagamento(f.stato, rataStato);
                  return (
                    <tr key={f.id}>
                      <td>
                        <span className="font-semibold text-ink">{f.numero ?? "Bozza"}</span>
                        <Sub>{formatData(f.dataEmissione)}</Sub>
                      </td>
                      <td>
                        <span className="font-medium text-ink">{cl}</span>
                        {causale && <Sub>{causale}</Sub>}
                      </td>
                      <td>{emittente}</td>
                      <td className="money text-right font-medium text-ink">
                        {formatEuro(f.imponibileCent)}
                      </td>
                      <td className="money text-right">
                        {formatEuro(f.ivaCent)}
                        {f.bolloCent > 0 && <Sub>+ bollo {formatEuro(f.bolloCent)}</Sub>}
                      </td>
                      <td className="money text-right font-semibold text-ink">
                        {formatEuro(f.totaleCent)}
                      </td>
                      <td>
                        {sdi && (
                          <Tag className="" tone={f.stato === "scartata" ? "orange" : "ink"}>
                            {sdi.label}
                          </Tag>
                        )}
                      </td>
                      <td>
                        <Tag tone={pag.tone}>{pag.label}</Tag>
                      </td>
                      <td className="text-right whitespace-nowrap">
                        <Link
                          href={`/fatture/${f.id}`}
                          className="text-[13px] font-medium underline-offset-4 hover:underline"
                        >
                          Apri
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

function pagamento(stato: string, rataStato: string | null) {
  if (stato === "bozza") return { label: "—", tone: "neutral" as const };
  if (stato === "pagata" || rataStato === "incassata")
    return { label: "Pagata", tone: "green" as const };
  if (rataStato === "scaduta") return { label: "Scaduta", tone: "orange" as const };
  if (stato === "parzialmente_pagata" || rataStato === "parziale")
    return { label: "Parziale", tone: "orange" as const };
  return { label: "Da incassare", tone: "blue" as const };
}

function Sub({ children }: { children: React.ReactNode }) {
  return <span className="mt-[3px] block text-xs font-normal text-muted">{children}</span>;
}

function Kpi({
  etichetta,
  valore,
  ultimo,
  children,
}: {
  etichetta: string;
  valore: string;
  ultimo?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-2 px-[26px] py-6", !ultimo && "border-r border-ink/8")}>
      <span className="eyebrow">{etichetta}</span>
      <b className="money text-[30px] leading-none font-semibold tracking-[-0.02em]">{valore}</b>
      {children}
    </div>
  );
}

function Chip({
  href,
  attivo,
  etichetta,
  n,
}: {
  href: string;
  attivo: boolean;
  etichetta: string;
  n: number;
}) {
  return (
    <Link
      href={href}
      aria-pressed={attivo}
      className={cn(
        "inline-flex min-h-10 items-center gap-2 rounded-full border px-4 text-[13px] leading-none font-medium",
        attivo
          ? "border-ink bg-ink text-paper"
          : "border-ink/16 bg-white/50 text-ink-2 hover:bg-white/80",
      )}
    >
      {etichetta} <b className="font-medium opacity-70">{n}</b>
    </Link>
  );
}

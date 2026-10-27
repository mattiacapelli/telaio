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
import { DetailBar } from "@/components/shell/topbar";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { regoleDa } from "@/lib/regole";
import { STATO_ABBONAMENTO, STATO_RATA } from "@/lib/stati";
import { st } from "@/lib/utils";
import { cambiaStatoAbbonamentoAction } from "../actions";

export const metadata = { title: "Abbonamento" };
export const dynamic = "force-dynamic";

const PERIODI: Record<string, string> = {
  mensile: "Mensile",
  trimestrale: "Trimestrale",
  semestrale: "Semestrale",
  annuale: "Annuale",
};
const AZIONI: Record<string, { stato: string; label: string; avviso?: boolean }[]> = {
  attivo: [
    { stato: "sospeso", label: "Sospendi" },
    { stato: "cessato", label: "Disdici", avviso: true },
  ],
  sospeso: [
    { stato: "attivo", label: "Riattiva" },
    { stato: "cessato", label: "Disdici", avviso: true },
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
  const cronologia = [
    ...versati.map(({ i }) => ({
      d: i.data,
      t: `Incasso registrato · ${formatEuro(i.importoCent)}`,
    })),
    { d: a.createdAt.toISOString().slice(0, 10), t: "Abbonamento creato" },
  ].sort((x, y) => (x.d < y.d ? 1 : -1));
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "senza IVA";

  const kpi = [
    ["Rata netta", formatEuro(a.importoRataCent), PERIODI[a.periodicita]?.toLowerCase() ?? ""],
    [
      "Rata con IVA",
      v.lordoCent !== null ? formatEuro(v.lordoCent) : "—",
      v.ivaCent !== null ? `${iva} ${formatEuro(v.ivaCent)}` : "senza IVA",
    ],
    [
      "Valore annuo",
      formatEuro(annuo),
      annuoV.lordoCent !== null ? `${formatEuro(annuoV.lordoCent)} con IVA` : "senza IVA",
    ],
    [
      "Incassato finora",
      formatEuro(incassato),
      `${pagate} rat${pagate === 1 ? "a pagata" : "e pagate"}`,
    ],
    [
      "Prossima rata",
      prossima ? formatData(prossima.scadenza).slice(0, 5) : "—",
      prossima ? formatEuro(prossima.importoCent) : "nessuna in programma",
    ],
  ];

  return (
    <>
      <DetailBar indietro={{ label: "Abbonamenti", href: "/abbonamenti" }}>
        <Link href={`/clienti/${cliente.twentyCompanyId ?? ""}`} className="bg sm bare">
          Scheda cliente
        </Link>
      </DetailBar>

      <section style={st("display:flex;flex-direction:column;gap:14px")}>
        <span className="eb">09 — Abbonamento</span>
        <h1
          className="d"
          style={st(
            "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
          )}
        >
          {cliente.nome}
        </h1>
        <p style={st("margin:0;font-size:17px;color:#3a372f")}>{a.descrizione}</p>
        <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
          <Tag tone={a.stato === "attivo" ? "ink" : "orange"}>{stato?.label ?? a.stato}</Tag>
          <span className="tag">{PERIODI[a.periodicita]}</span>
          <span className="tag">
            {rs.nome} · {iva}
          </span>
        </div>
      </section>

      <section
        className="card"
        style={st(
          "padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))",
        )}
      >
        {kpi.map(([e, val, sub], i) => (
          <div
            key={e}
            style={{
              padding: "22px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRight: i < kpi.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
            }}
          >
            <span className="eb">{e}</span>
            <b className="d num" style={st("font-weight:600;font-size:28px;letter-spacing:-.02em")}>
              {val}
            </b>
            <span className="num" style={st("font-size:13px;color:#3a372f")}>
              {sub}
            </span>
          </div>
        ))}
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
        <div style={st("flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:20px")}>
          <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
            <div
              style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
            >
              <h2 className="h2">Rate</h2>
              <Link
                href="/scadenzario"
                style={st("font-size:13px;text-decoration:underline;text-underline-offset:3px")}
              >
                Scadenzario
              </Link>
            </div>
            <div className="tw">
              <table className="tbl" style={{ minWidth: 560 }}>
                <thead>
                  <tr>
                    <th>Scadenza</th>
                    <th>N.</th>
                    <th>Fattura</th>
                    <th className="r">Importo</th>
                    <th>Stato</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {lista.map(({ r, fattura }) => {
                    const s = STATO_RATA[r.stato];
                    const aperta = ["da_incassare", "scaduta", "parziale"].includes(r.stato);
                    const rv = prezzoVisualizzato(r.importoCent, regole);
                    return (
                      <tr key={r.id}>
                        <td className="num">{formatData(r.scadenza)}</td>
                        <td className="num">{r.numero}</td>
                        <td>{fattura ?? "—"}</td>
                        <td className="r num" style={st("font-weight:600;color:#17150f")}>
                          {formatEuro(rv.lordoCent ?? r.importoCent)}
                          {rv.lordoCent !== null && (
                            <span className="sub">
                              {formatEuro(r.importoCent)} + IVA {formatEuro(rv.ivaCent ?? 0)}
                            </span>
                          )}
                        </td>
                        <td>
                          <Tag tone={s?.tone}>{s?.label ?? r.stato}</Tag>
                        </td>
                        <td className="r">
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
            </div>
          </div>

          <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
            <div
              style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
            >
              <h2 className="h2">Piano</h2>
              <span style={st("font-size:13px;color:#6b675c")}>
                dal {formatData(a.inizio)}
                {a.fine ? ` al ${formatData(a.fine)}` : " · senza scadenza"}
              </span>
            </div>
            <div
              style={st(
                "display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)",
              )}
            >
              <div
                style={st(
                  "display:flex;justify-content:space-between;gap:12px;padding:14px 0;border-bottom:1px solid rgba(23,21,15,.08)",
                )}
              >
                <span>
                  <b>{a.descrizione}</b>
                  <span className="sub">{PERIODI[a.periodicita]?.toLowerCase()}</span>
                </span>
                <span className="num" style={{ textAlign: "right" }}>
                  {formatEuro(v.nettoCent)}
                  {v.lordoCent !== null && (
                    <span className="sub">{formatEuro(v.lordoCent)} con IVA</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
            <h2 className="h2">Cronologia</h2>
            <div style={st("border-top:1px solid rgba(23,21,15,.14)")}>
              {cronologia.map((c, i) => (
                <div
                  key={`${c.d}-${i}`}
                  style={st(
                    "display:flex;gap:18px;padding:12px 0;border-bottom:1px solid rgba(23,21,15,.08);font-size:14px",
                  )}
                >
                  <span className="num" style={st("color:#6b675c;flex:none")}>
                    {formatData(c.d)}
                  </span>
                  <span>{c.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className="ink"
          style={st("flex:1 1 300px;min-width:0;display:flex;flex-direction:column;gap:14px")}
        >
          <span
            style={st(
              "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7)",
            )}
          >
            Gestione
          </span>
          <p style={st("margin:0;font-size:13px;line-height:1.6;color:rgba(244,243,240,.78)")}>
            Sospendere o disdire annulla le rate future ancora da incassare. Riattivando tornano da
            incassare e si rigenerano quelle mancanti.
          </p>
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            {(AZIONI[a.stato] ?? []).map((az) => (
              <form key={az.stato} action={cambiaStatoAbbonamentoAction}>
                <input type="hidden" name="id" value={a.id} />
                <input type="hidden" name="stato" value={az.stato} />
                <button
                  type="submit"
                  style={{
                    minHeight: 44,
                    padding: "0 18px",
                    borderRadius: 999,
                    border: az.avviso
                      ? "1px solid rgba(180,83,42,.6)"
                      : "1px solid rgba(244,243,240,.28)",
                    background: "none",
                    color: az.avviso ? "#e0916f" : "#f4f3f0",
                    font: "500 14px/1 Inter,sans-serif",
                    cursor: "pointer",
                  }}
                >
                  {az.label}
                </button>
              </form>
            ))}
            {(AZIONI[a.stato] ?? []).length === 0 && (
              <span style={st("font-size:13px;color:rgba(244,243,240,.7)")}>
                Abbonamento cessato.
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

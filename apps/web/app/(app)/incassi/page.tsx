import { formatEuro } from "@telaio/core";
import {
  clientiRef,
  conti,
  desc,
  eq,
  fatture,
  getDb,
  incassi,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import Link from "next/link";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { TopBar } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { formatData, oggi } from "@/lib/date";
import { st } from "@/lib/utils";

export const metadata = { title: "Incassi" };
export const dynamic = "force-dynamic";

const METODI = {
  bonifico: { label: "Bonifico", dot: "#17150f" },
  contante: { label: "Contante", dot: "#969184" },
  carta: { label: "Credito", dot: "#2b5ea7" },
} as const;
const MESI = [
  "gennaio",
  "febbraio",
  "marzo",
  "aprile",
  "maggio",
  "giugno",
  "luglio",
  "agosto",
  "settembre",
  "ottobre",
  "novembre",
  "dicembre",
];

export default async function IncassiPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m = "tutti" } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
  const mese = Number(dataOggi.slice(5, 7));
  const [lista, contiAttivi] = await Promise.all([
    db
      .select({
        i: incassi,
        conto: conti.nome,
        tipo: conti.tipo,
        cliente: clientiRef.nome,
        emittente: ragioniSociali.nome,
        fattura: fatture.numero,
        rataDescr: rate.descrizione,
      })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .leftJoin(clientiRef, eq(clientiRef.id, incassi.clienteRefId))
      .leftJoin(ragioniSociali, eq(ragioniSociali.id, incassi.ragioneSocialeId))
      .leftJoin(fatture, eq(fatture.id, incassi.fatturaId))
      .leftJoin(rate, eq(rate.id, incassi.rataId))
      .where(isNull(incassi.deletedAt))
      .orderBy(desc(incassi.data), desc(incassi.createdAt))
      .limit(300),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
  ]);

  const delMese = lista.filter(({ i }) => i.data >= inizioMese);
  const totMese = delMese.reduce((s, { i }) => s + i.importoCent, 0);
  const per = (t: keyof typeof METODI) => delMese.filter((x) => x.tipo === t);
  const somma = (xs: typeof lista) => xs.reduce((s, { i }) => s + i.importoCent, 0);
  const mostrati = m === "tutti" ? lista : lista.filter((x) => x.tipo === m);
  const nomiConti = (t: keyof typeof METODI) =>
    [...new Set(per(t).map((x) => x.conto))].join(", ") || "nessun movimento";

  return (
    <>
      <TopBar links={[{ label: "Scadenzario", href: "/scadenzario" }]}>
        <IncassoModal conti={contiAttivi} trigger="Registra incasso +" triggerSize="sm" />
      </TopBar>

      <PageHeader
        numero="07"
        sezione={`Incassi · ${MESI[mese - 1]} ${dataOggi.slice(0, 4)}`}
        titolo="Incassi"
        descrizione="Ogni incasso va su un conto preciso e chiude una rata o una fattura. Gli importi sono quelli realmente ricevuti; ogni incasso genera anche l'entrata in prima nota."
      />

      <section
        className="card"
        style={st(
          "padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))",
        )}
      >
        {[
          {
            e: "Totale mese",
            v: formatEuro(totMese),
            s: `${delMese.length} moviment${delMese.length === 1 ? "o" : "i"}`,
          },
          ...(["bonifico", "contante", "carta"] as const).map((t) => ({
            e: METODI[t].label,
            v: formatEuro(somma(per(t))),
            s: nomiConti(t),
            dot: METODI[t].dot,
          })),
        ].map((k, i, a) => (
          <div
            key={k.e}
            style={{
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRight: i < a.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
            }}
          >
            <span className="eb" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {"dot" in k && (
                <i
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: k.dot,
                    display: "block",
                  }}
                />
              )}
              {k.e}
            </span>
            <b
              className="d num"
              style={st("font-weight:600;font-size:30px;letter-spacing:-.02em;line-height:1")}
            >
              {k.v}
            </b>
            <span className="num" style={st("font-size:13px;color:#3a372f")}>
              {k.s}
            </span>
          </div>
        ))}
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px",
          )}
        >
          <h2 className="h2">Movimenti</h2>
          <div
            role="group"
            aria-label="Filtra per metodo"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            <Link href="/incassi" className={`chip${m === "tutti" ? " on" : ""}`}>
              Tutti <b>{lista.length}</b>
            </Link>
            {(Object.keys(METODI) as (keyof typeof METODI)[]).map((t) => (
              <Link key={t} href={`/incassi?m=${t}`} className={`chip${m === t ? " on" : ""}`}>
                {METODI[t].label} <b>{lista.filter((x) => x.tipo === t).length}</b>
              </Link>
            ))}
          </div>
        </div>
        {mostrati.length === 0 ? (
          <p style={st("margin:0;padding:12px 0;color:#3a372f")}>
            Nessun incasso registrato: registra il primo, aggiornerà scadenzario e prima nota.
          </p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Cliente · causale</th>
                  <th>Emittente · fattura</th>
                  <th>Conto</th>
                  <th>Metodo</th>
                  <th className="r">Importo</th>
                </tr>
              </thead>
              <tbody>
                {mostrati.map(({ i, conto, tipo, cliente, emittente, fattura, rataDescr }) => (
                  <tr key={i.id}>
                    <td className="num">{formatData(i.data)}</td>
                    <td>
                      <span style={st("font-weight:500;color:#17150f")}>{cliente ?? "—"}</span>
                      <span className="sub">{i.descrizione ?? rataDescr ?? "Incasso"}</span>
                    </td>
                    <td>
                      {emittente ?? "—"}
                      {fattura && <span className="sub num">{fattura}</span>}
                    </td>
                    <td>{conto}</td>
                    <td>
                      <span className="tag">
                        <i style={{ background: METODI[tipo].dot }} />
                        {METODI[tipo].label}
                      </span>
                    </td>
                    <td className="r num" style={st("font-weight:600;color:#17150f")}>
                      {formatEuro(i.importoCent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

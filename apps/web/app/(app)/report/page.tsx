import { formatEuro, formatEuroCompatto } from "@telaio/core";
import {
  and,
  conti,
  desc,
  eq,
  fatturaRighe,
  fatture,
  getDb,
  gte,
  isNull,
  lt,
  movimenti,
  ragioniSociali,
  sql,
} from "@telaio/db";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { oggi } from "@/lib/date";
import { intervallo, type Periodo, valorePeriodo } from "@/lib/periodo";
import { st } from "@/lib/utils";

export const metadata = { title: "Report ed export" };
export const dynamic = "force-dynamic";

const PERIODI: [Periodo, string][] = [
  ["mese", "Mese"],
  ["trimestre", "Trimestre"],
  ["anno", "Anno"],
];

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const p = valorePeriodo((await searchParams).p);
  const { da, a, etichetta } = intervallo(p, oggi());
  const db = getDb();
  const emesse = and(
    isNull(fatture.deletedAt),
    gte(fatture.dataEmissione, da),
    lt(fatture.dataEmissione, a),
    sql`${fatture.stato} <> 'bozza'`,
  );

  const [emittenti, perEmittente, costi, voci, clienti] = await Promise.all([
    db.select().from(ragioniSociali).where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        id: fatture.ragioneSocialeId,
        ricavi: sql<number>`coalesce(sum(${fatture.imponibileCent}),0)::int`,
        iva: sql<number>`coalesce(sum(${fatture.ivaCent}),0)::int`,
      })
      .from(fatture)
      .where(emesse)
      .groupBy(fatture.ragioneSocialeId),
    db
      .select({
        id: conti.ragioneSocialeId,
        tot: sql<number>`coalesce(sum(${movimenti.importoCent}),0)::int`,
      })
      .from(movimenti)
      .innerJoin(conti, eq(conti.id, movimenti.contoId))
      .where(
        and(
          isNull(movimenti.deletedAt),
          eq(movimenti.tipo, "uscita"),
          gte(movimenti.data, da),
          lt(movimenti.data, a),
        ),
      )
      .groupBy(conti.ragioneSocialeId),
    db
      .select({
        nome: fatturaRighe.descrizione,
        n: sql<number>`count(*)::int`,
        tot: sql<number>`sum(${fatturaRighe.importoCent})::int`,
      })
      .from(fatturaRighe)
      .innerJoin(fatture, eq(fatture.id, fatturaRighe.fatturaId))
      .where(emesse)
      .groupBy(fatturaRighe.descrizione)
      .orderBy(desc(sql`sum(${fatturaRighe.importoCent})`))
      .limit(7),
    db
      .select({
        nome: sql<string>`coalesce(${fatture.snapshot}->'cliente'->>'nome','—')`,
        tot: sql<number>`sum(${fatture.imponibileCent})::int`,
      })
      .from(fatture)
      .where(emesse)
      .groupBy(sql`1`)
      .orderBy(desc(sql`sum(${fatture.imponibileCent})`))
      .limit(5),
  ]);

  const ricavi = perEmittente.reduce((s, r) => s + r.ricavi, 0);
  const iva = perEmittente.reduce((s, r) => s + r.iva, 0);
  const costiTot = costi.reduce((s, r) => s + r.tot, 0);
  const margine = ricavi - costiTot;
  const maxVoce = Math.max(1, ...voci.map((v) => v.tot));

  return (
    <>
      <TopBar links={[{ label: "Cash flow", href: "/cash-flow" }]}>
        <a href={`/api/export/commercialista?tipo=fatture&p=${p}`} className="bp sm">
          Export commercialista <span aria-hidden="true">↓</span>
        </a>
      </TopBar>

      <section
        style={st(
          "display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:14px")}>
          <span className="eb">13 — Report ed export · {etichetta}</span>
          <h1
            className="d"
            style={st(
              "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
            )}
          >
            Come stanno andando
          </h1>
        </div>
        <div role="group" aria-label="Periodo" style={st("display:flex;flex-wrap:wrap;gap:8px")}>
          {PERIODI.map(([id, l]) => (
            <Link key={id} href={`/report?p=${id}`} className={`chip${p === id ? " on" : ""}`}>
              {l}
            </Link>
          ))}
        </div>
      </section>

      <section
        style={st(
          "display:flex;flex-wrap:wrap;gap:clamp(28px,5vw,56px);border-top:1px solid rgba(23,21,15,.14);padding-top:24px",
        )}
      >
        {[
          [ricavi, "Ricavi netti"],
          [iva, "IVA fatturata"],
          [costiTot, "Costi netti"],
          [margine, "Margine"],
        ].map(([v, e]) => (
          <div key={e} style={st("display:flex;flex-direction:column;gap:6px")}>
            <b
              className="d num"
              style={st("font-weight:600;font-size:34px;letter-spacing:-.02em;line-height:1")}
            >
              {formatEuroCompatto(v as number)}
            </b>
            <span className="eb">{e}</span>
          </div>
        ))}
      </section>

      <section
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px")}
      >
        {emittenti.map((e) => {
          const r = perEmittente.find((x) => x.id === e.id);
          const c = costi.find((x) => x.id === e.id)?.tot ?? 0;
          const ric = r?.ricavi ?? 0;
          const m = ric - c;
          return (
            <div
              key={e.id}
              className="card"
              style={st("display:flex;flex-direction:column;gap:14px;padding:24px")}
            >
              <div
                style={st(
                  "display:flex;justify-content:space-between;align-items:baseline;gap:12px",
                )}
              >
                <span
                  className="d"
                  style={st("font-size:20px;font-weight:600;letter-spacing:-.01em")}
                >
                  {e.nome}
                </span>
                <span style={st("font-size:12px;color:#6b675c")}>
                  {e.ivaAttiva ? `IVA ${e.aliquotaIvaBp / 100}%` : "senza IVA"}
                </span>
              </div>
              <b
                className="d num"
                style={st("font-size:30px;font-weight:600;letter-spacing:-.02em;line-height:1")}
              >
                {formatEuroCompatto(ric)}
              </b>
              <div style={st("height:8px;border-radius:8px;background:rgba(23,21,15,.08)")}>
                <div
                  style={{
                    width: `${ricavi ? Math.max(3, (ric / ricavi) * 100) : 0}%`,
                    height: "100%",
                    borderRadius: 8,
                    background: "#17150f",
                  }}
                />
              </div>
              {[
                ["IVA", e.ivaAttiva ? formatEuro(r?.iva ?? 0) : "non applicata"],
                ["Costi", formatEuro(c)],
                [
                  "Margine",
                  `${formatEuro(m)}${ric ? ` · ${Math.round((m / ric) * 100)}%` : ""}`,
                  true,
                ],
              ].map(([k, v, forte], i, arr) => (
                <div
                  key={k as string}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 14,
                    color: forte ? "#17150f" : "#6b675c",
                    fontWeight: forte ? 600 : 400,
                    padding: "8px 0",
                    borderTop: i === 0 ? "1px solid rgba(23,21,15,.08)" : undefined,
                    borderBottom: i < arr.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
                  }}
                >
                  <span>{k}</span>
                  <span className="num" style={{ color: "#17150f", fontWeight: forte ? 600 : 400 }}>
                    {v}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
        <div
          className="card"
          style={st("flex:1.3 1 420px;min-width:0;display:flex;flex-direction:column;gap:14px")}
        >
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Voci vendute</h2>
            <span style={st("font-size:13px;color:#6b675c")}>{etichetta} · netto</span>
          </div>
          {voci.length === 0 ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Nessuna fattura emessa nel periodo.
            </p>
          ) : (
            voci.map((v) => (
              <div key={v.nome} style={st("display:flex;flex-direction:column;gap:6px")}>
                <div style={st("display:flex;justify-content:space-between;font-size:14px")}>
                  <span>
                    {v.nome}{" "}
                    <span style={{ color: "#6b675c" }}>
                      · {v.n} vendit{v.n === 1 ? "a" : "e"}
                    </span>
                  </span>
                  <b className="num" style={{ fontWeight: 600 }}>
                    {formatEuroCompatto(v.tot)}
                  </b>
                </div>
                <div style={st("height:6px;border-radius:6px;background:rgba(23,21,15,.08)")}>
                  <div
                    style={{
                      width: `${Math.max(3, (v.tot / maxVoce) * 100)}%`,
                      height: "100%",
                      borderRadius: 6,
                      background: "#17150f",
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
        <div
          className="card"
          style={st("flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:14px")}
        >
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Clienti principali</h2>
            <span style={st("font-size:13px;color:#6b675c")}>{etichetta} · netto</span>
          </div>
          <div style={st("border-top:1px solid rgba(23,21,15,.14)")}>
            {clienti.length === 0 && (
              <p style={st("margin:14px 0 0;font-size:14px;color:#6b675c")}>
                Nessuna fattura emessa nel periodo.
              </p>
            )}
            {clienti.map((c) => (
              <div
                key={c.nome}
                style={st(
                  "display:flex;justify-content:space-between;gap:12px;padding:12px 0;border-bottom:1px solid rgba(23,21,15,.08);font-size:14px",
                )}
              >
                <b style={{ fontWeight: 600 }}>{c.nome}</b>
                <b className="num" style={{ fontWeight: 600 }}>
                  {formatEuroCompatto(c.tot)}
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="ink" style={st("display:flex;flex-direction:column;gap:16px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px",
          )}
        >
          <span className="d" style={st("font-size:22px;font-weight:500;letter-spacing:-.015em")}>
            Export per il commercialista
          </span>
        </div>
        <p
          style={st(
            "margin:0;font-size:14px;line-height:1.6;color:rgba(244,243,240,.78);max-width:62ch",
          )}
        >
          File CSV (separatore «;», importi con la virgola) del periodo selezionato:{" "}
          {etichetta.toLowerCase()}.
        </p>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;gap:10px;border-top:1px solid rgba(244,243,240,.16);padding-top:16px",
          )}
        >
          <a
            href={`/api/export/commercialista?tipo=fatture&p=${p}`}
            style={st(
              "display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;background:#f4f3f0;color:#17150f;font:500 14px/1 Inter,sans-serif",
            )}
          >
            Fatture emesse ↓
          </a>
          <a
            href={`/api/export/commercialista?tipo=prima-nota&p=${p}`}
            style={st(
              "display:inline-flex;align-items:center;min-height:44px;padding:0 20px;border-radius:999px;border:1px solid rgba(244,243,240,.28);color:#f4f3f0;font:500 14px/1 Inter,sans-serif",
            )}
          >
            Prima nota ↓
          </a>
        </div>
      </section>
    </>
  );
}

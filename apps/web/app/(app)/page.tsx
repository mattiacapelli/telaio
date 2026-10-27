import {
  formatEuro,
  formatEuroCompatto,
  prezzoVisualizzato,
  type RegoleFiscali,
} from "@telaio/core";
import {
  abbonamenti,
  and,
  clientiRef,
  conti,
  eq,
  getDb,
  inArray,
  isNull,
  pendingActions,
  preventivi,
  ragioniSociali,
  rate,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { saldiConti } from "@/lib/dominio/movimenti";
import { st } from "@/lib/utils";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const MESI = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
const MESI_LUNGHI = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];
const COLORI_CONTO = { bonifico: "#17150f", contante: "#969184", carta: "#2b5ea7" } as const;
const ETICHETTA_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Credito" } as const;
const TIPO_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Credito" } as const;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ em?: string }>;
}) {
  const { em } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const anno = Number(dataOggi.slice(0, 4));
  const mese = Number(dataOggi.slice(5, 7));
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
  const sei = new Date(Date.UTC(anno, mese - 6, 1)).toISOString().slice(0, 10);

  const filtroPrev = [
    isNull(preventivi.deletedAt),
    inArray(preventivi.stato, ["inviato", "in_revisione"]),
  ];
  if (em) filtroPrev.push(eq(preventivi.ragioneSocialeId, em));
  const filtroRate = em ? sql`and r.ragione_sociale_id = ${em}` : sql``;

  const [
    emittenti,
    aperti,
    incassiMese,
    dovuto,
    canoni,
    perMese,
    elencoConti,
    saldi,
    prossime,
    inAttesa,
    scartate,
    daEmettere,
    soll,
    azioni,
  ] = await Promise.all([
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        cliente: clientiRef.nome,
        unaTantum: sql<number>`coalesce((select sum(importo_cent) from preventivo_righe where preventivo_id = ${preventivi.id} and tipo = 'una_tantum'),0)::int`,
        canone: sql<number>`coalesce((select sum(case tipo when 'canone_annuo' then importo_cent when 'canone_mensile' then importo_cent * 12 else 0 end) from preventivo_righe where preventivo_id = ${preventivi.id}),0)::int`,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(and(...filtroPrev))
      .orderBy(preventivi.validoFino),
    db.execute<{ n: number; tot: number }>(
      sql`select count(*)::int n, coalesce(sum(i.importo_cent),0)::int tot from incassi i where i.deleted_at is null and i.data >= ${inizioMese} ${em ? sql`and i.ragione_sociale_id = ${em}` : sql``}`,
    ),
    db.execute<{ tot: number; scaduto: number; n_scaduti: number }>(sql`
        select coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)),0)::int tot,
               coalesce(sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) filter (where r.stato = 'scaduta'),0)::int scaduto,
               count(*) filter (where r.stato = 'scaduta')::int n_scaduti
        from rate r where r.stato in ('da_incassare','parziale','scaduta') ${filtroRate}`),
    db.execute<{ n: number; anno: number }>(sql`
        select count(*)::int n, coalesce(sum(a.importo_rata_cent * (case a.periodicita when 'mensile' then 12 when 'trimestrale' then 4 when 'semestrale' then 2 else 1 end)),0)::int anno
        from abbonamenti a where a.stato = 'attivo' and a.deleted_at is null ${em ? sql`and a.ragione_sociale_id = ${em}` : sql``}`),
    db.execute<{ ym: string; tipo: keyof typeof COLORI_CONTO; tot: number }>(sql`
        select to_char(i.data,'YYYY-MM') ym, c.tipo, sum(i.importo_cent)::int tot
        from incassi i join conti c on c.id = i.conto_id
        where i.deleted_at is null and i.data >= ${sei} ${em ? sql`and i.ragione_sociale_id = ${em}` : sql``}
        group by 1,2`),
    db.select().from(conti).where(isNull(conti.deletedAt)).orderBy(conti.nome),
    saldiConti(db),
    db
      .select({ r: rate, cliente: clientiRef.nome })
      .from(rate)
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "parziale", "scaduta"]))
      .orderBy(rate.scadenza)
      .limit(4),
    Promise.resolve(null),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from fatture where stato = 'scartata' and deleted_at is null`,
    ),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from fatture where stato = 'bozza' and deleted_at is null`,
    ),
    db.execute<{ n: number }>(
      sql`select count(*)::int n from solleciti where stato = 'da_confermare'`,
    ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(pendingActions)
      .where(eq(pendingActions.stato, "in_attesa")),
  ]);
  void inAttesa;

  // Preventivi aperti: imponibile e ivato
  let apertiNetto = 0;
  let apertiLordo = 0;
  for (const { p } of aperti) {
    apertiNetto += p.imponibileCent;
    apertiLordo += p.totaleCent;
  }
  const liquidita = [...saldi.values()].reduce((a, b) => a + b, 0);

  // Grafico: ultimi 6 mesi, impilato per tipo di conto
  const mesi = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(anno, mese - 1 - (5 - i), 1));
    return { ym: d.toISOString().slice(0, 7), label: MESI[d.getUTCMonth()] ?? "" };
  });
  const valori = mesi.map((m) => {
    const per = { bonifico: 0, contante: 0, carta: 0 };
    for (const r of perMese) if (r.ym === m.ym) per[r.tipo] += r.tot;
    return { ...m, ...per, tot: per.bonifico + per.contante + per.carta };
  });
  const massimo = Math.max(1, ...valori.map((v) => v.tot));

  // Pipeline Twenty
  const opp = await twentyDaEnv()
    .elencaOpportunita()
    .catch(() => []);
  const fasi = new Map<string, { n: number; tot: number }>();
  for (const o of opp) {
    const k = o.fase
      ? o.fase.charAt(0).toUpperCase() + o.fase.slice(1).toLowerCase().replace(/_/g, " ")
      : "Senza fase";
    const x = fasi.get(k) ?? { n: 0, tot: 0 };
    x.n += 1;
    x.tot += o.importoCent ?? 0;
    fasi.set(k, x);
  }
  const maxFase = Math.max(1, ...[...fasi.values()].map((f) => f.tot));

  const daSistemare = [
    {
      n: dovuto[0]?.n_scaduti ?? 0,
      t: "Rate scadute",
      s: "da sollecitare dallo scadenzario",
      href: "/scadenzario",
    },
    {
      n: soll[0]?.n ?? 0,
      t: "Solleciti da confermare",
      s: "nessuno parte senza il tuo ok",
      href: "/scadenzario",
    },
    {
      n: scartate[0]?.n ?? 0,
      t: "Fatture scartate dallo SDI",
      s: "da correggere e reinviare",
      href: "/fatture",
    },
    {
      n: daEmettere[0]?.n ?? 0,
      t: "Fatture in bozza da emettere",
      s: "ricevono il numero all'emissione",
      href: "/fatture",
    },
    {
      n: azioni[0]?.n ?? 0,
      t: "Azioni in attesa di conferma",
      s: "proposte da AI e API",
      href: "/azioni-in-attesa",
    },
  ].filter((x) => x.n > 0);

  const kpi = [
    {
      e: "Preventivi aperti",
      v: formatEuroCompatto(apertiNetto),
      s: `${formatEuro(apertiLordo)} con IVA · ${aperti.length} preventiv${aperti.length === 1 ? "o" : "i"}`,
    },
    {
      e: `Incassato ${MESI_LUNGHI[mese - 1]?.toLowerCase()}`,
      v: formatEuroCompatto(incassiMese[0]?.tot ?? 0),
      s: `${incassiMese[0]?.n ?? 0} moviment${incassiMese[0]?.n === 1 ? "o" : "i"}`,
    },
    {
      e: "Da incassare",
      v: formatEuroCompatto(dovuto[0]?.tot ?? 0),
      link:
        (dovuto[0]?.scaduto ?? 0) > 0
          ? {
              t: `${formatEuroCompatto(dovuto[0]?.scaduto ?? 0)} scaduti`,
              href: "/scadenzario",
              warn: true,
            }
          : { t: "nessuna scaduta", href: "/scadenzario" },
    },
    {
      e: "Canoni ricorrenti",
      v: formatEuroCompatto(canoni[0]?.anno ?? 0),
      per: "/anno",
      link: {
        t: `netto · ${canoni[0]?.n ?? 0} abbonament${canoni[0]?.n === 1 ? "o" : "i"}`,
        href: "/abbonamenti",
      },
    },
    {
      e: "Liquidità",
      v: formatEuroCompatto(liquidita),
      link: { t: "vedi cash flow", href: "/cash-flow" },
    },
  ];

  return (
    <>
      <TopBar links={[{ label: "Configuratore", href: "/configuratore" }]}>
        <Link href="/configuratore" className="bp sm">
          Nuovo preventivo <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="01"
        sezione="Dashboard"
        titolo={`${MESI_LUNGHI[mese - 1]} ${anno}`}
        destra={
          <div
            role="group"
            aria-label="Filtra per emittente"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            <Link href="/" className={`chip${em ? "" : " on"}`}>
              Tutte le ragioni sociali
            </Link>
            {emittenti.map((e) => (
              <Link key={e.id} href={`/?em=${e.id}`} className={`chip${em === e.id ? " on" : ""}`}>
                {e.nome}
              </Link>
            ))}
          </div>
        }
      />

      <section
        className="card"
        style={st(
          "padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))",
        )}
      >
        {kpi.map((k, i) => (
          <div
            key={k.e}
            style={{
              padding: "26px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              borderRight: i < kpi.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
            }}
          >
            <span className="eb">{k.e}</span>
            <b
              className="d num"
              style={st("font-weight:600;font-size:32px;letter-spacing:-.02em;line-height:1")}
            >
              {k.v}
              {k.per && (
                <span style={st("font-size:15px;color:#6b675c;font-weight:500")}>{k.per}</span>
              )}
            </b>
            {"s" in k && k.s && (
              <span className="num" style={st("font-size:13px;color:#3a372f")}>
                {k.s}
              </span>
            )}
            {"link" in k && k.link && (
              <Link
                href={k.link.href}
                style={{
                  fontSize: 13,
                  color: "warn" in k.link && k.link.warn ? "#8f3f1d" : "#3a372f",
                  fontWeight: "warn" in k.link && k.link.warn ? 500 : 400,
                  textDecoration: "underline",
                  textUnderlineOffset: 3,
                }}
              >
                {k.link.t}
              </Link>
            )}
          </div>
        ))}
      </section>

      <section
        className="fx"
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px")}
      >
        <div className="ink" style={st("display:flex;flex-direction:column;gap:6px")}>
          <span
            style={st(
              "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7);margin-bottom:8px",
            )}
          >
            Da sistemare oggi
          </span>
          {daSistemare.length === 0 && (
            <p
              style={st(
                "margin:0;font-size:14px;color:rgba(244,243,240,.78);padding:14px 0;border-top:1px solid rgba(244,243,240,.14)",
              )}
            >
              Tutto in regola: niente da sistemare.
            </p>
          )}
          {daSistemare.map((x) => (
            <Link key={x.t} href={x.href} className="todo" style={{ color: "#f4f3f0" }}>
              <b>{x.n}</b>
              <span style={st("flex:1;font-size:14px;line-height:1.5")}>
                {x.t}
                <span style={st("display:block;color:rgba(244,243,240,.7);font-size:13px")}>
                  {x.s}
                </span>
              </span>
              <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>

        <div
          className="card"
          style={st("grid-column:span 2;min-width:0;display:flex;flex-direction:column;gap:24px")}
        >
          <div
            style={st(
              "display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap",
            )}
          >
            <h2 className="h2">Incassi ultimi 6 mesi</h2>
            <div style={st("display:flex;gap:16px;font-size:13px;color:#3a372f")}>
              {(["bonifico", "contante", "carta"] as const).map((t) => (
                <span key={t} className="lg">
                  <i style={{ background: COLORI_CONTO[t] }} />
                  {ETICHETTA_CONTO[t]}
                </span>
              ))}
            </div>
          </div>
          <div
            style={st(
              "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px;align-items:end;height:220px;border-bottom:1px solid rgba(23,21,15,.14)",
            )}
          >
            {valori.map((v, i) => (
              <div
                key={v.ym}
                style={st(
                  "display:flex;flex-direction:column;justify-content:flex-end;height:100%;gap:6px",
                )}
              >
                <span
                  className="num"
                  style={{
                    fontSize: 12,
                    color: i === 5 ? "#17150f" : "#3a372f",
                    fontWeight: i === 5 ? 600 : 400,
                    textAlign: "center",
                  }}
                >
                  {v.tot > 0
                    ? new Intl.NumberFormat("it-IT", { useGrouping: "always" }).format(
                        Math.round(v.tot / 100),
                      )
                    : ""}
                </span>
                {v.tot > 0 && (
                  <div
                    style={{
                      height: `${Math.max(4, Math.round((v.tot / massimo) * 92))}%`,
                      display: "flex",
                      flexDirection: "column",
                      borderRadius: "8px 8px 0 0",
                      overflow: "hidden",
                    }}
                  >
                    <div style={{ flex: v.carta, background: COLORI_CONTO.carta }} />
                    <div style={{ flex: v.contante, background: COLORI_CONTO.contante }} />
                    <div style={{ flex: v.bonifico, background: COLORI_CONTO.bonifico }} />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div
            style={st(
              "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:18px;font-size:12px;color:#6b675c;text-align:center;margin-top:-12px",
            )}
          >
            {mesi.map((m, i) => (
              <span key={m.ym} style={i === 5 ? st("color:#17150f;font-weight:600") : undefined}>
                {m.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section
        className="fx"
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px")}
      >
        <div
          className="card"
          style={st("grid-column:span 2;min-width:0;display:flex;flex-direction:column;gap:18px")}
        >
          <div style={st("display:flex;justify-content:space-between;align-items:baseline")}>
            <h2 className="h2">Preventivi in attesa di risposta</h2>
            <Link
              href="/preventivi"
              style={st("font-size:13px;text-decoration:underline;text-underline-offset:3px")}
            >
              Vedi tutti
            </Link>
          </div>
          {aperti.length === 0 ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Nessun preventivo in attesa di risposta.
            </p>
          ) : (
            <div className="tw">
              <table className="tbl" style={{ minWidth: 660 }}>
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Cliente</th>
                    <th>Emittente</th>
                    <th className="r">Una tantum</th>
                    <th className="r">Canone</th>
                    <th>Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {aperti.slice(0, 4).map(({ p, emittente, cliente, unaTantum, canone }) => {
                    const regole = p.snapshot.regole as unknown as RegoleFiscali;
                    const ut = prezzoVisualizzato(unaTantum, regole);
                    const cn = prezzoVisualizzato(canone, regole);
                    const giorni = p.validoFino
                      ? Math.ceil(
                          (new Date(`${p.validoFino}T00:00:00Z`).getTime() -
                            new Date(`${dataOggi}T00:00:00Z`).getTime()) /
                            86400000,
                        )
                      : null;
                    const inScadenza = giorni !== null && giorni <= 7;
                    return (
                      <tr key={p.id}>
                        <td>
                          <Link href={`/preventivi/${p.id}`} style={{ fontWeight: 600 }}>
                            {p.numero ?? "Bozza"}
                          </Link>
                        </td>
                        <td>{cliente ?? "—"}</td>
                        <td>{emittente}</td>
                        <td className="r num">
                          {unaTantum > 0 ? (
                            <>
                              <span style={st("color:#17150f;font-weight:500")}>
                                {formatEuro(ut.nettoCent)}
                              </span>
                              {ut.lordoCent !== null && (
                                <span className="sub">{formatEuro(ut.lordoCent)} ivato</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="r num">
                          {canone > 0 ? (
                            <>
                              {formatEuro(cn.nettoCent)}/a
                              {cn.lordoCent !== null && (
                                <span className="sub">{formatEuro(cn.lordoCent)} ivato</span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          {inScadenza ? (
                            <span
                              className="tag"
                              style={{ borderColor: "rgba(180,83,42,.4)", color: "#8f3f1d" }}
                            >
                              <i style={{ background: "#b4532a" }} />
                              {giorni !== null && giorni < 0 ? "Scaduto" : `Scade tra ${giorni} gg`}
                            </span>
                          ) : (
                            <Tag tone="blue">
                              {p.stato === "in_revisione" ? "In revisione" : "Inviato"}
                            </Tag>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card" style={st("display:flex;flex-direction:column;gap:18px;min-width:0")}>
          <div style={st("display:flex;justify-content:space-between;align-items:baseline")}>
            <h2 className="h2">Saldi per conto</h2>
            <Link
              href="/conti"
              style={st("font-size:13px;text-decoration:underline;text-underline-offset:3px")}
            >
              Tutti
            </Link>
          </div>
          <div
            style={st("display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)")}
          >
            {elencoConti.map((c, i) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: "13px 0",
                  borderBottom:
                    i < elencoConti.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
                }}
              >
                <div style={st("display:flex;flex-direction:column;gap:4px")}>
                  <span style={st("font-weight:500;font-size:14px")}>{c.nome}</span>
                  <span style={st("font-size:12px;color:#6b675c")}>
                    {TIPO_CONTO[c.tipo]}
                    {c.iban ? ` · ••${c.iban.slice(-4)}` : ""}
                  </span>
                </div>
                <b className="num" style={st("font-weight:600;font-size:15px")}>
                  {formatEuroCompatto(saldi.get(c.id) ?? 0)}
                </b>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        className="fx"
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:20px")}
      >
        <div
          className="card"
          style={st("grid-column:span 2;min-width:0;display:flex;flex-direction:column;gap:18px")}
        >
          <div
            style={st(
              "display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:12px",
            )}
          >
            <h2 className="h2">Prossimi incassi</h2>
            <Link href="/incassi" className="bg sm">
              Registra incasso
            </Link>
          </div>
          {prossime.length === 0 ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>Nessun incasso in arrivo.</p>
          ) : (
            <div
              style={st(
                "display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:0;border-top:1px solid rgba(23,21,15,.14)",
              )}
            >
              {prossime.map(({ r, cliente }) => {
                const scaduta = r.scadenza < dataOggi;
                const [, m, g] = r.scadenza.split("-");
                return (
                  <div
                    key={r.id}
                    style={st("padding:18px 20px 4px 0;display:flex;flex-direction:column;gap:6px")}
                  >
                    <span className="eb" style={scaduta ? { color: "#8f3f1d" } : undefined}>
                      {scaduta ? "Scaduto · " : ""}
                      {Number(g)} {(MESI[Number(m) - 1] ?? "").toLowerCase()}
                    </span>
                    <span style={{ fontWeight: 500 }}>{cliente ?? "—"}</span>
                    <span style={st("font-size:13px;color:#3a372f")}>{r.descrizione}</span>
                    <b className="num d" style={st("font-weight:600;font-size:22px")}>
                      {formatEuro(r.importoCent)}
                    </b>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card" style={st("display:flex;flex-direction:column;gap:16px;min-width:0")}>
          <div style={st("display:flex;justify-content:space-between;align-items:baseline")}>
            <h2 className="h2">Pipeline Twenty</h2>
            <span className="eb" style={{ fontSize: 11 }}>
              Opportunità
            </span>
          </div>
          {fasi.size === 0 ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Nessuna opportunità da Twenty.
            </p>
          ) : (
            <div style={st("display:flex;flex-direction:column;gap:13px")}>
              {[...fasi.entries()].map(([fase, f]) => (
                <div key={fase} style={st("display:flex;flex-direction:column;gap:6px")}>
                  <div style={st("display:flex;justify-content:space-between;font-size:14px")}>
                    <span>{fase}</span>
                    <span className="num" style={{ color: "#3a372f" }}>
                      {f.n} · {formatEuroCompatto(f.tot)}
                    </span>
                  </div>
                  <div style={st("height:6px;border-radius:6px;background:rgba(23,21,15,.08)")}>
                    <div
                      style={{
                        width: `${Math.max(4, Math.round((f.tot / maxFase) * 100))}%`,
                        height: "100%",
                        borderRadius: 6,
                        background: "#969184",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

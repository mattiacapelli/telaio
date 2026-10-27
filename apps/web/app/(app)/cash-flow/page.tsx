import { aggiungiMesi, formatEuro, formatEuroCompatto } from "@telaio/core";
import { conti, getDb, isNull, movimenti, preventivi, rate, sql } from "@telaio/db";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { oggi } from "@/lib/date";
import { saldiConti } from "@/lib/dominio/movimenti";
import { st } from "@/lib/utils";

export const metadata = { title: "Cash flow" };
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
/** Peso dei preventivi in attesa: stima prudente, finché non c'è uno storico di accettazione. */
const PROBABILITA = 0.5;

export default async function CashFlowPage({
  searchParams,
}: {
  searchParams: Promise<{ pv?: string; prud?: string }>;
}) {
  const { pv = "1", prud = "0" } = await searchParams;
  const conPreventivi = pv === "1";
  const prudente = prud === "1";
  const db = getDb();
  const dataOggi = oggi();
  const primo = `${dataOggi.slice(0, 7)}-01`;
  const mesi = Array.from({ length: 6 }, (_, i) => {
    const d = aggiungiMesi(primo, i + 1);
    return {
      ym: d.slice(0, 7),
      label: MESI[Number(d.slice(5, 7)) - 1] ?? "",
      lungo: MESI_LUNGHI[Number(d.slice(5, 7)) - 1] ?? "",
    };
  });
  const finestra = aggiungiMesi(primo, 7);
  const treMesiFa = aggiungiMesi(primo, -3);

  const [saldi, contiAttivi, dovute, attesa, spese] = await Promise.all([
    saldiConti(db),
    db.select({ id: conti.id }).from(conti).where(isNull(conti.deletedAt)),
    db.execute<{ ym: string; tot: number }>(sql`
      select to_char(case when r.scadenza < ${primo}::date then ${primo}::date else r.scadenza end,'YYYY-MM') ym,
             sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0))::int tot
      from ${rate} r where r.stato in ('da_incassare','parziale','scaduta') group by 1`),
    db.execute<{ ym: string; tot: number }>(sql`
      select to_char(coalesce(p.valido_fino, ${primo}::date + interval '1 month'),'YYYY-MM') ym, sum(p.totale_cent)::int tot
      from ${preventivi} p where p.stato in ('inviato','in_revisione') and p.deleted_at is null group by 1`),
    db.execute<{ tot: number }>(sql`
      select coalesce(sum(m.importo_cent),0)::int tot from ${movimenti} m
      where m.tipo = 'uscita' and m.deleted_at is null and m.data >= ${treMesiFa} and m.data < ${primo}`),
  ]);

  const liquidita = [...saldi.values()].reduce((a, b) => a + b, 0);
  const usciteMese = Math.round((spese[0]?.tot ?? 0) / 3);
  const perMese = (righe: { ym: string; tot: number }[], ym: string) =>
    righe.filter((r) => r.ym === ym).reduce((s, r) => s + r.tot, 0);

  // Scenario prudente: gli incassi arrivano con un mese di ritardo.
  const incassiCerti = mesi.map((m, i) => {
    const sorgente = prudente ? (mesi[i - 1]?.ym ?? "") : m.ym;
    return perMese(dovute, sorgente);
  });
  const righe = mesi.map((m, i) => {
    const certi = incassiCerti[i] ?? 0;
    const pesati = conPreventivi ? Math.round(perMese(attesa, m.ym) * PROBABILITA) : 0;
    return { ...m, certi, pesati, uscite: usciteMese };
  });
  let saldo = liquidita;
  const serie = righe.map((r) => {
    saldo += r.certi + r.pesati - r.uscite;
    return { ...r, saldo };
  });
  const massimo = Math.max(1, ...serie.map((r) => Math.max(r.certi + r.pesati, r.uscite)));
  const minimo = serie.reduce(
    (a, b) => (b.saldo < a.saldo ? b : a),
    serie[0] ?? { saldo: 0, lungo: "—" },
  );
  const fine = serie.at(-1)?.saldo ?? liquidita;
  const maxS = Math.max(...serie.map((r) => r.saldo), liquidita);
  const minS = Math.min(...serie.map((r) => r.saldo), liquidita);
  const punti = serie
    .map(
      (r, i) =>
        `${(i / Math.max(1, serie.length - 1)) * 100},${100 - ((r.saldo - minS) / Math.max(1, maxS - minS)) * 100}`,
    )
    .join(" ");
  const toggle = (on: boolean) => ({ background: on ? "#17150f" : "#c3bfb4" });
  const href = (p: Record<string, string>) =>
    `/cash-flow?${new URLSearchParams({ pv, prud, ...p })}`;

  return (
    <>
      <TopBar links={[{ label: "Scadenzario", href: "/scadenzario" }]}>
        <Link href="/report" className="bp sm">
          Report <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="12"
        sezione="Cash flow previsionale"
        titolo="Prossimi sei mesi"
        descrizione="Parte dalla liquidità di oggi, aggiunge le rate e i canoni in scadenza e toglie la spesa media degli ultimi tre mesi. I preventivi in attesa li conti solo se vuoi, pesati al 50%."
      />

      <section
        className="card"
        style={st(
          "display:flex;flex-wrap:wrap;gap:16px 40px;justify-content:space-between;align-items:center;padding:24px 30px",
        )}
      >
        <Link
          href={href({ pv: conPreventivi ? "0" : "1" })}
          style={st("display:flex;align-items:center;gap:14px;font-size:14px")}
        >
          <span className="sw" aria-hidden style={toggle(conPreventivi)}>
            <span style={{ left: conPreventivi ? 21 : 3 }} />
          </span>
          Includi preventivi in attesa, pesati per probabilità
        </Link>
        <Link
          href={href({ prud: prudente ? "0" : "1" })}
          style={st("display:flex;align-items:center;gap:14px;font-size:14px")}
        >
          <span className="sw" aria-hidden style={toggle(prudente)}>
            <span style={{ left: prudente ? 21 : 3 }} />
          </span>
          Scenario prudente: incassi in ritardo di un mese
        </Link>
      </section>

      <section
        style={st(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;border-top:1px solid rgba(23,21,15,.14);padding-top:24px",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:8px")}>
          <span className="eb">Liquidità oggi</span>
          <b
            className="d num"
            style={st("font-weight:600;font-size:32px;letter-spacing:-.02em;line-height:1")}
          >
            {formatEuro(liquidita)}
          </b>
          <span className="num" style={st("font-size:13px;color:#3a372f")}>
            {contiAttivi.length} conti
          </span>
        </div>
        <div style={st("display:flex;flex-direction:column;gap:8px")}>
          <span className="eb">Fra sei mesi</span>
          <b
            className="d num"
            style={st("font-weight:600;font-size:32px;letter-spacing:-.02em;line-height:1")}
          >
            {formatEuro(fine)}
          </b>
          <span className="num" style={st("font-size:13px;color:#3a372f")}>
            {fine >= liquidita ? "+" : "−"} {formatEuro(Math.abs(fine - liquidita))} rispetto a oggi
          </span>
        </div>
        <div style={st("display:flex;flex-direction:column;gap:8px")}>
          <span className="eb">Mese più stretto</span>
          <b
            className="d"
            style={st("font-weight:600;font-size:32px;letter-spacing:-.02em;line-height:1")}
          >
            {minimo.lungo}
          </b>
          <span className="num" style={st("font-size:13px;color:#3a372f")}>
            saldo minimo {formatEuroCompatto(minimo.saldo)}
          </span>
        </div>
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:24px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px",
          )}
        >
          <h2 className="h2">Entrate e uscite previste</h2>
          <div style={st("display:flex;flex-wrap:wrap;gap:16px")}>
            <span className="lg">
              <i style={{ background: "#17150f" }} />
              Incassi certi
            </span>
            {conPreventivi && (
              <span className="lg">
                <i style={{ background: "#2b5ea7" }} />
                Preventivi pesati
              </span>
            )}
            <span className="lg">
              <i style={{ background: "#b4532a" }} />
              Uscite stimate
            </span>
          </div>
        </div>
        <div
          style={st(
            "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px;align-items:end;height:260px;border-bottom:1px solid rgba(23,21,15,.14)",
          )}
        >
          {serie.map((r) => (
            <div key={r.ym} style={st("display:flex;gap:6px;align-items:flex-end;height:100%")}>
              <div
                style={{
                  flex: 1,
                  height: `${((r.certi + r.pesati) / massimo) * 100}%`,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: "6px 6px 0 0",
                  overflow: "hidden",
                }}
              >
                <div style={{ flex: r.pesati, background: "#2b5ea7" }} />
                <div style={{ flex: r.certi, background: "#17150f" }} />
              </div>
              <div
                style={{
                  flex: 1,
                  height: `${(r.uscite / massimo) * 100}%`,
                  background: "#b4532a",
                  borderRadius: "6px 6px 0 0",
                }}
              />
            </div>
          ))}
        </div>
        <div
          style={st(
            "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px;font-size:13px;color:#3a372f;text-align:center;margin-top:-12px",
          )}
        >
          {serie.map((r) => (
            <span key={r.ym}>{r.label}</span>
          ))}
        </div>
      </section>

      <section className="ink" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px",
          )}
        >
          <span className="d" style={st("font-size:22px;font-weight:500;letter-spacing:-.015em")}>
            Saldo di cassa a fine mese
          </span>
          <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
            somma dei {contiAttivi.length} conti
          </span>
        </div>
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ width: "100%", height: 110 }}
          aria-hidden
        >
          <polyline
            points={punti}
            fill="none"
            stroke="#f4f3f0"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div
          style={st(
            "display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:20px;text-align:center",
          )}
        >
          {serie.map((r) => (
            <div key={r.ym} style={st("display:flex;flex-direction:column;gap:4px")}>
              <span style={st("font-size:12px;color:rgba(244,243,240,.7)")}>{r.label}</span>
              <b className="num" style={st("font-weight:600;font-size:15px")}>
                {formatEuroCompatto(r.saldo)}
              </b>
            </div>
          ))}
        </div>
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
        <h2 className="h2">Dettaglio per mese</h2>
        <div className="tw">
          <table className="tbl" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>Mese</th>
                <th className="r">Incassi certi</th>
                <th className="r">Preventivi pesati</th>
                <th className="r">Uscite stimate</th>
                <th className="r">Saldo fine mese</th>
              </tr>
            </thead>
            <tbody>
              {serie.map((r) => (
                <tr key={r.ym}>
                  <td style={st("font-weight:600;color:#17150f")}>{r.lungo}</td>
                  <td className="r num">{formatEuro(r.certi)}</td>
                  <td className="r num">{conPreventivi ? formatEuro(r.pesati) : "—"}</td>
                  <td className="r num">− {formatEuro(r.uscite)}</td>
                  <td className="r num" style={st("font-weight:600;color:#17150f")}>
                    {formatEuro(r.saldo)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={st("margin:0;font-size:13px;color:#6b675c")}>
          Le uscite sono la media mensile degli ultimi tre mesi di prima nota; le scadenze fiscali
          non sono ancora incluse.
        </p>
      </section>
    </>
  );
}

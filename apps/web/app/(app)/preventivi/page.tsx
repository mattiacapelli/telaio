import {
  formatEuro,
  formatEuroCompatto,
  prezzoVisualizzato,
  type RegoleFiscali,
} from "@telaio/core";
import { and, clientiRef, desc, eq, getDb, isNull, preventivi, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { FiltroEmittente } from "@/components/shell/filtro-emittente";
import { TopBar } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { sqlCanoneAnnuo, sqlUnaTantum } from "@/lib/queries";
import { STATO_PREVENTIVO } from "@/lib/stati";
import { st } from "@/lib/utils";

export const metadata = { title: "Preventivi" };
export const dynamic = "force-dynamic";

const FILTRI = [
  ["tutti", "Tutti"],
  ["bozza", "Bozza"],
  ["inviato", "Inviato"],
  ["in_scadenza", "In scadenza"],
  ["accettato", "Accettato"],
  ["rifiutato", "Rifiutato"],
  ["scaduto", "Scaduto"],
] as const;

const giorniA = (data: string, da: string) =>
  Math.ceil(
    (new Date(`${data}T00:00:00Z`).getTime() - new Date(`${da}T00:00:00Z`).getTime()) / 86400000,
  );

export default async function PreventiviPage({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string; em?: string }>;
}) {
  const { stato = "tutti", em } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const [emittenti, tutti] = await Promise.all([
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        cliente: clientiRef.nome,
        unaTantum: sqlUnaTantum,
        canone: sqlCanoneAnnuo,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, preventivi.clienteRefId))
      .where(
        and(isNull(preventivi.deletedAt), em ? eq(preventivi.ragioneSocialeId, em) : undefined),
      )
      .orderBy(desc(preventivi.createdAt))
      .limit(300),
  ]);

  const inScadenza = (p: (typeof tutti)[number]["p"]) =>
    p.stato === "inviato" &&
    !!p.validoFino &&
    giorniA(p.validoFino, dataOggi) <= 7 &&
    giorniA(p.validoFino, dataOggi) >= 0;
  const conta = (f: string) =>
    f === "tutti"
      ? tutti.length
      : f === "in_scadenza"
        ? tutti.filter(({ p }) => inScadenza(p)).length
        : tutti.filter(({ p }) => p.stato === f).length;
  const mostrati = tutti.filter(
    ({ p }) => stato === "tutti" || (stato === "in_scadenza" ? inScadenza(p) : p.stato === stato),
  );

  const attesa = tutti.filter(({ p }) => p.stato === "inviato" || p.stato === "in_revisione");
  const attesaNetto = attesa.reduce((s, { p }) => s + p.imponibileCent, 0);
  const attesaLordo = attesa.reduce((s, { p }) => s + p.totaleCent, 0);
  const limite = new Date(Date.now() - 90 * 86400000);
  const chiusi = tutti.filter(
    ({ p }) => p.createdAt >= limite && ["accettato", "rifiutato", "scaduto"].includes(p.stato),
  );
  const accettazione = chiusi.length
    ? Math.round((chiusi.filter(({ p }) => p.stato === "accettato").length / chiusi.length) * 100)
    : null;

  const qs = (s: string) =>
    `/preventivi?${new URLSearchParams({ ...(em ? { em } : {}), stato: s })}`;

  const kpi: [string, string, string?][] = [
    [String(conta("bozza")), "Bozze"],
    [String(attesa.length), "In attesa"],
    [String(conta("accettato")), "Accettati"],
    [formatEuro(attesaNetto), "In attesa, netto", `${formatEuro(attesaLordo)} con IVA`],
    [accettazione === null ? "—" : `${accettazione}%`, "Accettazione 90 gg"],
  ];

  return (
    <>
      <TopBar links={[{ label: "Configuratore", href: "/configuratore" }]}>
        <Link href="/configuratore" className="bp sm">
          Nuovo preventivo <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="03"
        sezione="Preventivi"
        titolo="Preventivi"
        descrizione="Ogni preventivo parte da un listino, è emesso da una delle tue ragioni sociali e aggiorna l'opportunità in Twenty quando cambia stato."
        azione={
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            <Link href="/configuratore" className="bp sm">
              Nuovo da listino <span aria-hidden="true">→</span>
            </Link>
          </div>
        }
      />

      <section
        style={st(
          "display:flex;flex-wrap:wrap;gap:clamp(28px,5vw,56px);border-top:1px solid rgba(23,21,15,.14);padding-top:24px",
        )}
      >
        {kpi.map(([v, e, sub]) => (
          <div key={e} style={st("display:flex;flex-direction:column;gap:6px")}>
            <b
              className="d num"
              style={st("font-weight:600;font-size:30px;letter-spacing:-.02em;line-height:1")}
            >
              {v}
            </b>
            <span className="eb">{e}</span>
            {sub && (
              <span className="num" style={st("font-size:13px;color:#3a372f")}>
                {sub}
              </span>
            )}
          </div>
        ))}
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div style={st("display:flex;flex-wrap:wrap;gap:10px 24px;justify-content:space-between")}>
          <div
            role="group"
            aria-label="Filtra per stato"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            {FILTRI.map(([id, label]) => (
              <Link key={id} href={qs(id)} className={`chip${stato === id ? " on" : ""}`}>
                {label} <b>{conta(id)}</b>
              </Link>
            ))}
          </div>
          <FiltroEmittente emittenti={emittenti} />
        </div>
        <div className="tw">
          <table className="tbl" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th>Numero</th>
                <th>Cliente</th>
                <th>Oggetto</th>
                <th>Emittente</th>
                <th className="r">Una tantum netto</th>
                <th className="r">Canone netto</th>
                <th>Stato</th>
                <th>Data</th>
              </tr>
            </thead>
            <tbody>
              {mostrati.map(({ p, emittente, cliente, unaTantum, canone }) => {
                const regole = p.snapshot.regole as unknown as RegoleFiscali;
                const ut = prezzoVisualizzato(unaTantum, regole);
                const cn = prezzoVisualizzato(canone, regole);
                const s = STATO_PREVENTIVO[p.stato];
                const scad = inScadenza(p);
                const look = scad
                  ? "warn"
                  : p.stato === "accettato"
                    ? "solid"
                    : p.stato === "rifiutato"
                      ? "muted"
                      : undefined;
                return (
                  <tr key={p.id}>
                    <td>
                      <Link
                        href={`/preventivi/${p.id}`}
                        style={st("font-weight:600;color:#17150f")}
                      >
                        {p.numero ?? "Bozza"}
                      </Link>
                    </td>
                    <td>{cliente ?? "—"}</td>
                    <td>{p.oggetto}</td>
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
                      <Tag tone={scad ? "orange" : (s?.tone ?? "neutral")} look={look}>
                        {scad
                          ? `Scade tra ${giorniA(p.validoFino ?? dataOggi, dataOggi)} gg`
                          : (s?.label ?? p.stato)}
                      </Tag>
                    </td>
                    <td className="num">{formatData(p.createdAt.toISOString())}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {mostrati.length === 0 && (
          <p style={st("margin:0;padding:24px 0;text-align:center;color:#3a372f")}>
            Nessun preventivo con questi filtri.
          </p>
        )}
      </section>
    </>
  );
}

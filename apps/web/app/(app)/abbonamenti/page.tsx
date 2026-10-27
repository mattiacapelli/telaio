import {
  aggiungiMesi,
  formatAliquota,
  formatEuro,
  importoRataDaCanoneAnnuo,
  MESI_PER_PERIODICITA,
  type Periodicita,
  prezzoVisualizzato,
} from "@telaio/core";
import {
  abbonamenti,
  asc,
  clientiRef,
  desc,
  eq,
  getDb,
  isNull,
  ragioniSociali,
  rate,
} from "@telaio/db";
import Link from "next/link";
import { AbbonamentoModal } from "@/components/domain/abbonamento-modal";
import { TopBar } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { formatData, oggi } from "@/lib/date";
import { regoleDa } from "@/lib/regole";
import { STATO_ABBONAMENTO } from "@/lib/stati";
import { st } from "@/lib/utils";

export const metadata = { title: "Abbonamenti" };
export const dynamic = "force-dynamic";

const PERIODI: Record<string, string> = {
  mensile: "Mensile",
  trimestrale: "Trimestrale",
  semestrale: "Semestrale",
  annuale: "Annuale",
};

export default async function AbbonamentiPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const { p = "tutti" } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const [lista, clienti, emittenti, prossime] = await Promise.all([
    db
      .select({ a: abbonamenti, cliente: clientiRef.nome, rs: ragioniSociali })
      .from(abbonamenti)
      .innerJoin(clientiRef, eq(clientiRef.id, abbonamenti.clienteRefId))
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, abbonamenti.ragioneSocialeId))
      .where(isNull(abbonamenti.deletedAt))
      .orderBy(desc(abbonamenti.createdAt)),
    db
      .select({ id: clientiRef.id, nome: clientiRef.nome })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt))
      .orderBy(clientiRef.nome),
    db
      .select({ id: ragioniSociali.id, nome: ragioniSociali.nome })
      .from(ragioniSociali)
      .where(isNull(ragioniSociali.deletedAt)),
    db
      .select({ abbonamentoId: rate.abbonamentoId, scadenza: rate.scadenza })
      .from(rate)
      .where(eq(rate.stato, "da_incassare"))
      .orderBy(asc(rate.scadenza)),
  ]);

  const prossima = new Map<string, string>();
  for (const r of prossime)
    if (r.abbonamentoId && r.scadenza >= dataOggi && !prossima.has(r.abbonamentoId))
      prossima.set(r.abbonamentoId, r.scadenza);

  const annuo = (a: (typeof lista)[number]["a"]) =>
    (a.importoRataCent * 12) / MESI_PER_PERIODICITA[a.periodicita as Periodicita];
  const attivi = lista.filter(({ a }) => a.stato === "attivo");
  const arr = Math.round(attivi.reduce((s, { a }) => s + annuo(a), 0));
  const arrLordo = Math.round(
    attivi.reduce(
      (s, { a, rs }) =>
        s + (prezzoVisualizzato(Math.round(annuo(a)), regoleDa(rs)).lordoCent ?? annuo(a)),
      0,
    ),
  );
  const entro60 = aggiungiMesi(dataOggi, 2);
  const rinnovi = attivi.filter(({ a }) => (prossima.get(a.id) ?? "9999") <= entro60).length;
  const filtri = ["tutti", "mensile", "trimestrale", "semestrale", "annuale"] as const;
  const mostrati = p === "tutti" ? lista : lista.filter(({ a }) => a.periodicita === p);
  void importoRataDaCanoneAnnuo;

  const kpi: [string, string, string?][] = [
    [formatEuro(arr), "Ricavo annuo netto", `${formatEuro(arrLordo)} con IVA`],
    [formatEuro(Math.round(arr / 12)), "Media mensile netta"],
    [String(attivi.length), "Attivi"],
    [String(rinnovi), "Rate entro 60 gg"],
  ];

  return (
    <>
      <TopBar links={[{ label: "Scadenzario", href: "/scadenzario" }]}>
        <AbbonamentoModal clienti={clienti} emittenti={emittenti} />
      </TopBar>

      <PageHeader
        numero="09"
        sezione="Abbonamenti"
        titolo="Canoni ricorrenti"
        descrizione="Ogni abbonamento genera le rate in anticipo, sullo scadenzario, in modo idempotente. Sospendere o cessare annulla le rate future ancora da incassare."
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
              style={st("font-weight:600;font-size:34px;letter-spacing:-.02em;line-height:1")}
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

      <section
        className="card"
        style={st("min-width:0;display:flex;flex-direction:column;gap:16px")}
      >
        <div
          style={st(
            "display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center",
          )}
        >
          <h2 className="h2">Abbonamenti</h2>
          <div
            role="group"
            aria-label="Filtra per periodicità"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            {filtri.map((f) => (
              <Link
                key={f}
                href={f === "tutti" ? "/abbonamenti" : `/abbonamenti?p=${f}`}
                className={`chip${p === f ? " on" : ""}`}
              >
                {f === "tutti" ? "Tutti" : PERIODI[f]}{" "}
                <b>
                  {f === "tutti"
                    ? lista.length
                    : lista.filter(({ a }) => a.periodicita === f).length}
                </b>
              </Link>
            ))}
          </div>
        </div>
        {mostrati.length === 0 ? (
          <p
            style={st(
              "margin:0;padding:12px 0;color:#3a372f;border-top:1px solid rgba(23,21,15,.14)",
            )}
          >
            Nessun abbonamento: creane uno, le rate compaiono nello scadenzario.
          </p>
        ) : (
          <div
            style={st("display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)")}
          >
            {mostrati.map(({ a, cliente, rs }) => {
              const regole = regoleDa(rs);
              const v = prezzoVisualizzato(a.importoRataCent, regole);
              const s = STATO_ABBONAMENTO[a.stato];
              const pross = prossima.get(a.id);
              return (
                <Link
                  key={a.id}
                  href={`/abbonamenti/${a.id}`}
                  className="rowlink"
                  style={st(
                    "display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr)) 40px;gap:10px 18px;align-items:center;padding:16px 14px;border-bottom:1px solid rgba(23,21,15,.08);border-radius:14px;color:#17150f",
                  )}
                >
                  <span>
                    <span style={st("font-weight:600;display:block")}>{cliente}</span>
                    <span className="sub">{a.descrizione}</span>
                  </span>
                  <span style={st("font-size:14px;color:#3a372f")}>
                    {rs.nome}
                    <span className="sub">
                      {PERIODI[a.periodicita]} ·{" "}
                      {regole.ivaAttiva
                        ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}`
                        : "senza IVA"}
                    </span>
                  </span>
                  <span className="num" style={{ textAlign: "right" }}>
                    <span style={st("font-weight:600;display:block")}>
                      {formatEuro(v.nettoCent)}
                    </span>
                    <span className="sub">
                      {v.lordoCent !== null ? `${formatEuro(v.lordoCent)} con IVA` : "a rata"}
                    </span>
                  </span>
                  <span
                    style={st("display:flex;flex-direction:column;align-items:flex-end;gap:6px")}
                  >
                    <span
                      className="tag"
                      style={a.stato === "cessato" ? { color: "#6b675c" } : undefined}
                    >
                      <i
                        style={{
                          background:
                            a.stato === "attivo"
                              ? "#17150f"
                              : a.stato === "sospeso"
                                ? "#b4532a"
                                : "#c3bfb4",
                        }}
                      />
                      {s?.label ?? a.stato}
                    </span>
                    <span className="sub num">{pross ? `prossima ${formatData(pross)}` : "—"}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    style={st(
                      "width:36px;height:36px;border-radius:50%;border:1px solid rgba(23,21,15,.16);display:grid;place-items:center;justify-self:end",
                    )}
                  >
                    →
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}

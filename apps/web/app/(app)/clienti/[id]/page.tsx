import {
  formatEuro,
  formatEuroCompatto,
  prezzoVisualizzato,
  type RegoleFiscali,
} from "@telaio/core";
import {
  clientiRef,
  conti,
  desc,
  eq,
  getDb,
  incassi,
  isNull,
  preventivi,
  ragioniSociali,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DetailBar } from "@/components/shell/topbar";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { sqlCanoneAnnuo, sqlUnaTantum } from "@/lib/queries";
import { STATO_PREVENTIVO } from "@/lib/stati";
import { st } from "@/lib/utils";

export const metadata = { title: "Cliente" };
export const dynamic = "force-dynamic";

const FASI = ["Nuovo lead", "Qualificato", "Proposta inviata", "Negoziazione", "Vinto"];
const norm = (s: string | null) => (s ?? "").toLowerCase().replace(/_/g, " ");
const COLORE_CONTO = { bonifico: "#17150f", contante: "#969184", carta: "#2b5ea7" } as const;
const NOME_CONTO = { bonifico: "Bonifico", contante: "Contante", carta: "Credito" } as const;

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const twenty = twentyDaEnv();
  const cliente = await twenty.dettaglioCliente(id).catch(() => null);
  if (!cliente) notFound();
  const db = getDb();
  const [persone, opportunita, [ref]] = await Promise.all([
    twenty.elencaPersone(id).catch(() => []),
    twenty.elencaOpportunita(id).catch(() => []),
    db.select().from(clientiRef).where(eq(clientiRef.twentyCompanyId, id)),
  ]);
  const refId = ref?.id ?? "00000000-0000-0000-0000-000000000000";
  const [prev, versati, somme] = await Promise.all([
    db
      .select({
        p: preventivi,
        emittente: ragioniSociali.nome,
        unaTantum: sqlUnaTantum,
        canone: sqlCanoneAnnuo,
      })
      .from(preventivi)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, preventivi.ragioneSocialeId))
      .where(sql`${preventivi.clienteRefId} = ${refId} and ${preventivi.deletedAt} is null`)
      .orderBy(desc(preventivi.createdAt)),
    db
      .select({ i: incassi, conto: conti.nome, tipo: conti.tipo })
      .from(incassi)
      .innerJoin(conti, eq(conti.id, incassi.contoId))
      .where(sql`${incassi.clienteRefId} = ${refId} and ${incassi.deletedAt} is null`)
      .orderBy(desc(incassi.data)),
    db.execute<{ da_incassare: number; canoni: number }>(sql`
      select coalesce((select sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) from rate r where r.cliente_ref_id = ${refId} and r.stato in ('da_incassare','parziale','scaduta')),0)::int da_incassare,
             coalesce((select sum(a.importo_rata_cent * (case a.periodicita when 'mensile' then 12 when 'trimestrale' then 4 when 'semestrale' then 2 else 1 end)) from abbonamenti a where a.cliente_ref_id = ${refId} and a.stato = 'attivo' and a.deleted_at is null),0)::int canoni`),
  ]);

  const preventivato = prev
    .filter(({ p }) => p.stato !== "bozza")
    .reduce((s, { p }) => s + p.imponibileCent, 0);
  const accettato = prev
    .filter(({ p }) => p.stato === "accettato")
    .reduce((s, { p }) => s + p.imponibileCent, 0);
  const incassato = versati.reduce((s, { i }) => s + i.importoCent, 0);
  const kpi = [
    ["Preventivato", formatEuroCompatto(preventivato)],
    ["Accettato", formatEuroCompatto(accettato)],
    ["Incassato", formatEuroCompatto(incassato)],
    ["Da incassare", formatEuroCompatto(somme[0]?.da_incassare ?? 0)],
    ["Canoni attivi", formatEuroCompatto(somme[0]?.canoni ?? 0), "/anno"],
  ] as const;
  const dati: [string, string | null, boolean?][] = [
    ["Ragione sociale", cliente.nome],
    ["P.IVA", cliente.partitaIva, true],
    ["Codice fiscale", cliente.codiceFiscale, true],
    ["PEC", cliente.pec],
    ["Codice SDI", cliente.codiceSdi, true],
    ["Sede", cliente.citta],
  ];
  const opp = opportunita[0];
  const faseIdx = opp ? FASI.findIndex((f) => norm(f) === norm(opp.fase)) : -1;
  const iniziali = (n: string) =>
    n
      .split(" ")
      .map((x) => x[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

  return (
    <>
      <DetailBar indietro={{ label: "Clienti", href: "/clienti" }}>
        <Link href="/configuratore" className="bg sm bare">
          Configuratore
        </Link>
        <Link href={`/configuratore?cliente=${cliente.id}`} className="bp sm">
          Nuovo preventivo <span aria-hidden="true">→</span>
        </Link>
      </DetailBar>

      <section
        style={st(
          "display:flex;flex-wrap:wrap;gap:24px;align-items:flex-end;justify-content:space-between",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:14px")}>
          <span className="eb">02 — Cliente · da Twenty</span>
          <h1
            className="d"
            style={st(
              "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
            )}
          >
            {cliente.nome}
          </h1>
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            <Tag tone="ink">{ref ? "Cliente" : "Prospect"}</Tag>
            {cliente.pa && <span className="tag">Pubblica amministrazione</span>}
            {cliente.citta && <span className="tag">{cliente.citta}</span>}
          </div>
        </div>
        <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
          {cliente.sito && (
            <a
              href={cliente.sito.startsWith("http") ? cliente.sito : `https://${cliente.sito}`}
              className="bg"
            >
              Sito <span aria-hidden="true">↗</span>
            </a>
          )}
          <Link href="/incassi" className="bg">
            Registra incasso
          </Link>
          <Link href={`/configuratore?cliente=${cliente.id}`} className="bp">
            Nuovo preventivo <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section
        className="card"
        style={st(
          "padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr))",
        )}
      >
        {kpi.map(([e, v, per], i) => (
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
              {v}
              {per && <span style={st("font-size:15px;color:#6b675c;font-weight:500")}>{per}</span>}
            </b>
          </div>
        ))}
      </section>

      <section
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px")}
      >
        <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Anagrafica</h2>
            <span style={st("font-size:12px;color:#6b675c")}>Sola lettura · Company</span>
          </div>
          <dl style={st("margin:0;border-top:1px solid rgba(23,21,15,.14)")}>
            {dati.map(([k, v, num], i) => (
              <div
                key={k}
                className="kv"
                style={i === dati.length - 1 ? { borderBottom: 0 } : undefined}
              >
                <dt>{k}</dt>
                <dd className={num ? "num" : undefined}>{v ?? "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Contatti</h2>
            <span style={st("font-size:12px;color:#6b675c")}>People · {persone.length}</span>
          </div>
          <div
            style={st("display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)")}
          >
            {persone.length === 0 && (
              <p style={st("margin:16px 0 0;font-size:14px;color:#6b675c")}>
                Nessuna persona collegata.
              </p>
            )}
            {persone.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: "16px 0",
                  borderBottom: i < persone.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
                }}
              >
                <span
                  className="d"
                  style={st(
                    "flex:none;width:42px;height:42px;border-radius:50%;background:#eceae5;display:grid;place-items:center;font-weight:600;font-size:14px",
                  )}
                >
                  {iniziali(p.nome)}
                </span>
                <div style={st("display:flex;flex-direction:column;gap:4px;font-size:14px")}>
                  <span style={{ fontWeight: 600 }}>{p.nome}</span>
                  {p.ruolo && <span style={st("color:#6b675c;font-size:13px")}>{p.ruolo}</span>}
                  {p.email && <span>{p.email}</span>}
                  {p.telefono && <span className="num">{p.telefono}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ink" style={st("display:flex;flex-direction:column;gap:18px")}>
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <span
              style={st(
                "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7)",
              )}
            >
              Opportunità · Twenty
            </span>
          </div>
          {opp ? (
            <>
              <div style={st("display:flex;flex-direction:column;gap:8px")}>
                <span
                  className="d"
                  style={st(
                    "font-size:26px;font-weight:500;letter-spacing:-.02em;line-height:1.15;color:rgba(244,243,240,.94)",
                  )}
                >
                  {opp.nome}
                </span>
                {opp.importoCent !== null && (
                  <b
                    className="d num"
                    style={st(
                      "font-size:40px;font-weight:600;letter-spacing:-.03em;color:rgba(244,243,240,.94)",
                    )}
                  >
                    {formatEuroCompatto(opp.importoCent)}
                  </b>
                )}
              </div>
              <ol
                style={st(
                  "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:0;border-top:1px solid rgba(244,243,240,.16)",
                )}
              >
                {FASI.map((f, i) => {
                  const attuale = i === faseIdx;
                  const passata = faseIdx >= 0 && i < faseIdx;
                  return (
                    <li
                      key={f}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 0",
                        fontSize: 14,
                        color: attuale ? "#f4f3f0" : "rgba(244,243,240,.62)",
                        fontWeight: attuale ? 600 : 400,
                      }}
                    >
                      <i
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          display: "block",
                          background: attuale
                            ? "#f4f3f0"
                            : passata
                              ? "rgba(244,243,240,.4)"
                              : undefined,
                          border:
                            !attuale && !passata ? "1px solid rgba(244,243,240,.4)" : undefined,
                          boxShadow: attuale ? "0 0 0 4px rgba(244,243,240,.18)" : undefined,
                        }}
                      />
                      {f}
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p style={st("margin:0;font-size:14px;color:rgba(244,243,240,.78)")}>
              Nessuna opportunità aperta su Twenty.
            </p>
          )}
        </div>
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}>
          <h2 className="h2">Preventivi</h2>
          <Link href={`/configuratore?cliente=${cliente.id}`} className="bg sm">
            Nuovo
          </Link>
        </div>
        {prev.length === 0 ? (
          <p style={st("margin:0;font-size:14px;color:#6b675c")}>
            Nessun preventivo per questo cliente.
          </p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Numero</th>
                  <th>Oggetto</th>
                  <th>Emittente</th>
                  <th className="r">Una tantum netto</th>
                  <th className="r">Canone netto</th>
                  <th>Stato</th>
                  <th>Data</th>
                </tr>
              </thead>
              <tbody>
                {prev.map(({ p, emittente, unaTantum, canone }) => {
                  const regole = p.snapshot.regole as unknown as RegoleFiscali;
                  const ut = prezzoVisualizzato(unaTantum, regole);
                  const cn = prezzoVisualizzato(canone, regole);
                  const s = STATO_PREVENTIVO[p.stato];
                  return (
                    <tr key={p.id}>
                      <td>
                        <Link href={`/preventivi/${p.id}`} style={{ fontWeight: 600 }}>
                          {p.numero ?? "Bozza"}
                        </Link>
                      </td>
                      <td>{p.oggetto}</td>
                      <td>{emittente}</td>
                      <td className="r num">
                        {unaTantum > 0 ? (
                          <>
                            {formatEuro(ut.nettoCent)}
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
                        <Tag tone={s?.tone}>{s?.label ?? p.stato}</Tag>
                      </td>
                      <td className="num">{formatData(p.createdAt.toISOString())}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}>
          <h2 className="h2">Incassi</h2>
          <Link href="/incassi" className="bg sm">
            Registra incasso
          </Link>
        </div>
        {versati.length === 0 ? (
          <p style={st("margin:0;font-size:14px;color:#6b675c")}>Nessun incasso registrato.</p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 620 }}>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Causale</th>
                  <th>Conto</th>
                  <th>Metodo</th>
                  <th className="r">Importo</th>
                </tr>
              </thead>
              <tbody>
                {versati.map(({ i, conto, tipo }) => (
                  <tr key={i.id}>
                    <td className="num">{formatData(i.data)}</td>
                    <td>{i.descrizione ?? "Incasso"}</td>
                    <td>{conto}</td>
                    <td>
                      <span className="tag">
                        <i style={{ background: COLORE_CONTO[tipo] }} />
                        {NOME_CONTO[tipo]}
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

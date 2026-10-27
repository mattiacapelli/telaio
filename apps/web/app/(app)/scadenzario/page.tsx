import { formatEuro, GIORNI_TRA_SOLLECITI, giorniDiRitardo, LIVELLO_MASSIMO } from "@telaio/core";
import {
  and,
  asc,
  clientiRef,
  conti,
  eq,
  getDb,
  gte,
  inArray,
  isNull,
  ragioniSociali,
  rate,
  solleciti,
  sql,
} from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { IncassoModal } from "@/components/domain/incasso-modal";
import { TopBar } from "@/components/shell/topbar";
import { Field, Input, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { formatData, oggi } from "@/lib/date";
import { st } from "@/lib/utils";
import { inviaSollecitoAction, scartaSollecitoAction } from "./actions";

export const metadata = { title: "Scadenzario" };
export const dynamic = "force-dynamic";

const LIVELLI = [
  ["Primo sollecito", "Email · dopo la scadenza"],
  ["Secondo sollecito", `Email · ${GIORNI_TRA_SOLLECITI} giorni dopo il primo`],
  ["Avviso formale", "Email · tono deciso, ultimo livello"],
];

export default async function ScadenzarioPage({
  searchParams,
}: {
  searchParams: Promise<{ f?: string }>;
}) {
  const { f = "tutte" } = await searchParams;
  const db = getDb();
  const dataOggi = oggi();
  const inizioMese = `${dataOggi.slice(0, 7)}-01`;
  const [lista, bozze, contiAttivi, inviati] = await Promise.all([
    db
      .select({
        r: rate,
        cliente: clientiRef.nome,
        emittente: ragioniSociali.nome,
        incassato: sql<number>`coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = ${rate.id} and i.deleted_at is null),0)::int`,
        nSoll: sql<number>`(select count(*)::int from solleciti s where s.rata_id = ${rate.id} and s.stato = 'inviato')`,
        bozza: sql<
          string | null
        >`(select s.id from solleciti s where s.rata_id = ${rate.id} and s.stato = 'da_confermare' limit 1)`,
      })
      .from(rate)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, rate.ragioneSocialeId))
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(inArray(rate.stato, ["da_incassare", "scaduta", "parziale"]))
      .orderBy(asc(rate.scadenza))
      .limit(300),
    db
      .select({
        s: solleciti,
        r: rate,
        cliente: clientiRef.nome,
        pec: clientiRef.pec,
        twentyId: clientiRef.twentyCompanyId,
      })
      .from(solleciti)
      .innerJoin(rate, eq(rate.id, solleciti.rataId))
      .leftJoin(clientiRef, eq(clientiRef.id, rate.clienteRefId))
      .where(eq(solleciti.stato, "da_confermare"))
      .orderBy(asc(rate.scadenza)),
    db.select({ id: conti.id, nome: conti.nome }).from(conti).where(isNull(conti.deletedAt)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(solleciti)
      .where(
        and(
          eq(solleciti.stato, "inviato"),
          gte(solleciti.inviatoIl, new Date(`${inizioMese}T00:00:00Z`)),
        ),
      ),
  ]);

  const twenty = twentyDaEnv();
  const suggerimenti = new Map<string, string>();
  for (const { s, pec, twentyId } of bozze) {
    const persona = twentyId
      ? (await twenty.elencaPersone(twentyId).catch(() => [])).find((p) => p.email)
      : undefined;
    suggerimenti.set(s.id, persona?.email ?? pec ?? "");
  }

  const residuo = (x: (typeof lista)[number]) => Math.max(0, x.r.importoCent - x.incassato);
  const scadute = lista.filter(({ r }) => r.scadenza < dataOggi);
  const fra30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const prossime = lista.filter(({ r }) => r.scadenza >= dataOggi && r.scadenza <= fra30);
  const somma = (xs: typeof lista) => xs.reduce((s, x) => s + residuo(x), 0);
  const maxRitardo = scadute.reduce(
    (m, { r }) => Math.max(m, giorniDiRitardo(r.scadenza, dataOggi)),
    0,
  );
  const mostrate = f === "scadute" ? scadute : f === "prossime" ? prossime : lista;
  const filtri = [
    ["tutte", "Tutte", lista.length],
    ["scadute", "Scadute", scadute.length],
    ["prossime", "Prossimi 30 gg", prossime.length],
  ] as const;
  const anteprima = bozze[0];

  const kpi = [
    {
      e: "Da incassare",
      v: formatEuro(somma(lista)),
      s: `${lista.length} rat${lista.length === 1 ? "a" : "e"}`,
    },
    {
      e: "Scaduto",
      v: formatEuro(somma(scadute)),
      s: scadute.length
        ? `${scadute.length} rat${scadute.length === 1 ? "a" : "e"} · ${maxRitardo} giorni`
        : "nessuna rata scaduta",
      warn: true,
    },
    {
      e: "Prossimi 30 giorni",
      v: formatEuro(somma(prossime)),
      s: `${prossime.length} rat${prossime.length === 1 ? "a" : "e"}`,
    },
    { e: "Solleciti inviati", v: String(inviati[0]?.n ?? 0), s: "questo mese" },
  ];

  return (
    <>
      <TopBar links={[{ label: "Incassi", href: "/incassi" }]}>
        <Link href="/cash-flow" className="bp sm">
          Cash flow <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="08"
        sezione="Scadenzario e solleciti"
        titolo="Da incassare"
        descrizione="Rate dei preventivi accettati e canoni in scadenza. I solleciti li prepara il sistema con il mittente e l'IBAN della ragione sociale giusta; li invii tu, dopo averli riletti."
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
              padding: "24px 26px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
              borderRight: i < kpi.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
            }}
          >
            <span
              className="eb"
              style={k.warn && k.v !== formatEuro(0) ? { color: "#8f3f1d" } : undefined}
            >
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

      {bozze.length > 0 && (
        <section className="ink" style={st("display:flex;flex-direction:column;gap:6px")}>
          <div
            style={st(
              "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:8px",
            )}
          >
            <span className="d" style={st("font-size:22px;font-weight:500;letter-spacing:-.015em")}>
              Solleciti da confermare
            </span>
            <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
              Nessun sollecito parte da solo: rivedi testo e destinatario, poi conferma.
            </span>
          </div>
          {bozze.map(({ s, r, cliente }) => (
            <div
              key={s.id}
              className="todo"
              style={{ flexWrap: "wrap", justifyContent: "space-between" }}
            >
              <div style={st("display:flex;flex-direction:column;gap:4px")}>
                <span style={{ fontWeight: 600 }}>
                  {cliente ?? "Cliente"} · {r.descrizione}
                </span>
                <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
                  {giorniDiRitardo(r.scadenza, dataOggi)} giorni di ritardo · livello {s.livello} ·{" "}
                  {formatEuro(r.importoCent)}
                </span>
              </div>
              <div style={st("display:flex;gap:8px;align-items:center")}>
                <FormModal
                  trigger="Rivedi e invia"
                  triggerVariant="glass"
                  triggerSize="sm"
                  title="Rivedi il sollecito"
                  description="L'email parte solo quando premi «Invia sollecito»."
                  submitLabel="Invia sollecito"
                  action={inviaSollecitoAction}
                >
                  <input type="hidden" name="id" value={s.id} />
                  <Field
                    label="Destinatario"
                    name="destinatario"
                    hint={
                      suggerimenti.get(s.id)
                        ? undefined
                        : "Nessun indirizzo trovato su Twenty: inseriscilo a mano"
                    }
                  >
                    <Input
                      name="destinatario"
                      type="email"
                      required
                      defaultValue={suggerimenti.get(s.id)}
                    />
                  </Field>
                  <Field label="Oggetto" name="oggetto">
                    <Input name="oggetto" required defaultValue={s.oggetto ?? ""} />
                  </Field>
                  <Field label="Testo" name="corpo">
                    <Textarea
                      name="corpo"
                      required
                      defaultValue={s.corpo ?? ""}
                      style={{ minHeight: 224 }}
                    />
                  </Field>
                </FormModal>
                <form action={scartaSollecitoAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button
                    type="submit"
                    style={st(
                      "min-height:40px;padding:0 16px;border-radius:999px;border:1px solid rgba(244,243,240,.28);background:none;color:rgba(244,243,240,.9);font:500 13px/1 Inter,sans-serif;cursor:pointer",
                    )}
                  >
                    Scarta
                  </button>
                </form>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card" style={st("display:flex;flex-direction:column;gap:18px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px",
          )}
        >
          <h2 className="h2">Rate e scadenze</h2>
          <div role="group" aria-label="Filtra" style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            {filtri.map(([id, label, n]) => (
              <Link
                key={id}
                href={`/scadenzario?f=${id}`}
                className={`chip${f === id ? " on" : ""}`}
              >
                {label} <b>{n}</b>
              </Link>
            ))}
          </div>
        </div>
        {mostrate.length === 0 ? (
          <p style={st("margin:0;padding:12px 0;color:#3a372f")}>Nessuna rata con questi filtri.</p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th>Scadenza</th>
                  <th>Cliente · rata</th>
                  <th>Emittente</th>
                  <th className="r">Importo</th>
                  <th>Solleciti</th>
                  <th>Prossima azione</th>
                </tr>
              </thead>
              <tbody>
                {mostrate.map((x) => {
                  const { r, cliente, emittente, nSoll, bozza } = x;
                  const scaduta = r.scadenza < dataOggi;
                  const rit = giorniDiRitardo(r.scadenza, dataOggi);
                  return (
                    <tr key={r.id}>
                      <td className="num">
                        <span style={{ color: scaduta ? "#8f3f1d" : "#17150f", fontWeight: 600 }}>
                          {formatData(r.scadenza)}
                        </span>
                        <span className="sub">
                          {scaduta
                            ? `scaduta da ${rit} giorni`
                            : r.stato === "parziale"
                              ? "pagata in parte"
                              : "da incassare"}
                        </span>
                      </td>
                      <td>
                        <span style={st("font-weight:500;color:#17150f")}>{cliente ?? "—"}</span>
                        <span className="sub">{r.descrizione}</span>
                      </td>
                      <td>{emittente}</td>
                      <td className="r num" style={st("font-weight:600;color:#17150f")}>
                        {formatEuro(residuo(x))}
                        {x.incassato > 0 && (
                          <span className="sub">su {formatEuro(r.importoCent)}</span>
                        )}
                      </td>
                      <td>
                        {nSoll > 0 ? (
                          <Tag tone="orange">
                            {nSoll} inviat{nSoll === 1 ? "o" : "i"}
                          </Tag>
                        ) : (
                          <span style={{ color: "#6b675c" }}>—</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {bozza ? (
                          <Tag tone="orange">Bozza da confermare</Tag>
                        ) : (
                          <IncassoModal
                            conti={contiAttivi}
                            rataId={r.id}
                            importoCent={residuo(x)}
                            descrizione={r.descrizione}
                            trigger="Registra incasso"
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
        )}
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
        <div
          className="card"
          style={st("flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:16px")}
        >
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Cadenza dei solleciti</h2>
            <span style={st("font-size:12px;color:#6b675c")}>sempre con tua conferma</span>
          </div>
          <div
            style={st("display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)")}
          >
            {LIVELLI.slice(0, LIVELLO_MASSIMO).map(([t, d], i) => (
              <div
                key={t}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  padding: "14px 0",
                  borderBottom: i < LIVELLI.length - 1 ? "1px solid rgba(23,21,15,.08)" : undefined,
                }}
              >
                <span
                  className="num"
                  style={st("flex:none;width:64px;font-size:12px;color:#6b675c")}
                >
                  Livello {i + 1}
                </span>
                <div style={st("display:flex;flex-direction:column;gap:2px;flex:1")}>
                  <span style={st("font-weight:600;font-size:15px")}>{t}</span>
                  <span style={st("font-size:13px;color:#3a372f")}>{d}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={st("margin:0;font-size:13px;line-height:1.6;color:#3a372f")}>
            Il sistema prepara la bozza ogni mattina per le rate scadute; non ne propone un'altra
            finché ce n'è una in attesa e aspetta {GIORNI_TRA_SOLLECITI} giorni dall&apos;ultimo
            inviato. I solleciti si fermano appena l&apos;incasso viene registrato.
          </p>
        </div>

        <div
          className="ink"
          style={st("flex:1.4 1 420px;min-width:0;display:flex;flex-direction:column;gap:16px")}
        >
          <div style={st("display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px")}>
            <span
              style={st(
                "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7)",
              )}
            >
              Anteprima · {anteprima ? `livello ${anteprima.s.livello}` : "ultima bozza"}
            </span>
          </div>
          <div
            style={st(
              "background:#f4f3f0;color:#17150f;border-radius:18px;padding:22px 24px;display:flex;flex-direction:column;gap:12px;font-size:14px;line-height:1.6",
            )}
          >
            {anteprima ? (
              <>
                <b>Oggetto: {anteprima.s.oggetto}</b>
                <div style={{ whiteSpace: "pre-wrap" }}>{anteprima.s.corpo}</div>
              </>
            ) : (
              <span style={{ color: "#6b675c" }}>
                Quando una rata scade, la bozza del sollecito compare qui per essere riletta e
                confermata.
              </span>
            )}
          </div>
        </div>
      </section>
    </>
  );
}

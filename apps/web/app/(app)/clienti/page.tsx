import { formatEuro } from "@telaio/core";
import { clientiRef, getDb, isNull, preventivi, rate, sql } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { PageHeader } from "@/components/ui/page-header";
import { Tag } from "@/components/ui/tag";
import { st } from "@/lib/utils";

export const metadata = { title: "Clienti" };
export const dynamic = "force-dynamic";

type Relazione = "cliente" | "prospect";
const FILTRI: { id: Relazione | "tutti"; label: string }[] = [
  { id: "tutti", label: "Tutti" },
  { id: "cliente", label: "Clienti" },
  { id: "prospect", label: "Prospect" },
];

export default async function ClientiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; stato?: string }>;
}) {
  const { q, stato } = await searchParams;
  const twenty = twentyDaEnv();
  const db = getDb();
  let errore: string | null = null;
  const [tutti, opportunita, locali] = await Promise.all([
    twenty.elencaClienti({ testo: q, limite: 200 }).catch((e: Error) => {
      errore = e.message;
      return [];
    }),
    twenty.elencaOpportunita().catch(() => []),
    db
      .select({
        twentyId: clientiRef.twentyCompanyId,
        prev: sql<number>`(select count(*)::int from ${preventivi} p where p.cliente_ref_id = ${clientiRef.id} and p.deleted_at is null)`,
        fatture: sql<number>`(select count(*)::int from fatture f where f.cliente_ref_id = ${clientiRef.id} and f.deleted_at is null and f.stato <> 'bozza')`,
        abb: sql<number>`(select count(*)::int from abbonamenti a where a.cliente_ref_id = ${clientiRef.id} and a.deleted_at is null)`,
        daIncassare: sql<number>`coalesce((select sum(r.importo_cent - coalesce((select sum(i.importo_cent) from incassi i where i.rata_id = r.id and i.deleted_at is null),0)) from ${rate} r where r.cliente_ref_id = ${clientiRef.id} and r.stato in ('da_incassare','parziale','scaduta')),0)::int`,
      })
      .from(clientiRef)
      .where(isNull(clientiRef.deletedAt)),
  ]);

  const perTwenty = new Map(locali.map((l) => [l.twentyId, l]));
  const righe = await Promise.all(
    tutti.map(async (c) => {
      const l = perTwenty.get(c.id);
      const relazione: Relazione = l && (l.fatture > 0 || l.abb > 0) ? "cliente" : "prospect";
      return {
        c,
        relazione,
        prev: l?.prev ?? 0,
        daIncassare: l?.daIncassare ?? 0,
        opp: opportunita.filter((o) => o.companyId === c.id),
      };
    }),
  );
  const conteggi = {
    tutti: righe.length,
    cliente: righe.filter((r) => r.relazione === "cliente").length,
    prospect: righe.filter((r) => r.relazione === "prospect").length,
  };
  const mostrate = righe.filter((r) => !stato || stato === "tutti" || r.relazione === stato);
  const href = (s: string) => `/clienti?${new URLSearchParams({ ...(q ? { q } : {}), stato: s })}`;

  return (
    <>
      <TopBar links={[{ label: "Configuratore", href: "/configuratore" }]}>
        <Link href="/preventivi/nuovo" className="bp sm">
          Nuovo preventivo <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="02"
        sezione="Clienti"
        titolo="Clienti"
        descrizione="Anagrafiche, contatti e opportunità arrivano da Twenty. Qui aggiungi la parte economica: preventivi, incassi e saldi."
        azione={
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            {twenty.finto ? (
              <Tag tone="orange">Dati finti · imposta TWENTY_API_URL</Tag>
            ) : (
              <Tag tone="blue">Twenty collegato</Tag>
            )}
          </div>
        }
      />

      <section className="card" style={st("display:flex;flex-direction:column;gap:22px")}>
        <div
          style={st(
            "display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center",
          )}
        >
          <div
            role="group"
            aria-label="Filtra per stato relazione"
            style={st("display:flex;flex-wrap:wrap;gap:8px")}
          >
            {FILTRI.map((f) => (
              <Link
                key={f.id}
                href={href(f.id)}
                className={`chip${(stato ?? "tutti") === f.id ? " on" : ""}`}
              >
                {f.label} <b>{conteggi[f.id]}</b>
              </Link>
            ))}
          </div>
          <form
            role="search"
            style={st(
              "display:flex;align-items:center;gap:10px;min-height:44px;padding:0 16px;border-radius:999px;border:1px solid rgba(23,21,15,.16);background:rgba(255,255,255,.6);color:#6b675c;flex:0 1 300px",
            )}
          >
            {stato && <input type="hidden" name="stato" value={stato} />}
            <svg
              aria-hidden="true"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              aria-label="Cerca cliente"
              placeholder="Nome, P.IVA"
              style={st(
                "flex:1;min-width:0;border:0;background:none;outline:none;font:400 14px Inter,sans-serif;color:#17150f",
              )}
            />
          </form>
        </div>

        {errore && (
          <p
            role="alert"
            style={st(
              "margin:0;padding:12px 16px;border-radius:14px;background:#17150f;color:#f4f3f0;font-size:14px",
            )}
          >
            Twenty non risponde: {errore}
          </p>
        )}

        {mostrate.length === 0 ? (
          <p style={st("margin:0;font-size:14px;color:#6b675c")}>Nessun cliente trovato.</p>
        ) : (
          <div className="tw">
            <table className="tbl" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Azienda</th>
                  <th>P.IVA</th>
                  <th>Stato</th>
                  <th>Opportunità aperta</th>
                  <th className="r">Preventivi</th>
                  <th className="r">Da incassare</th>
                  <th>
                    <span style={{ position: "absolute", left: -9999 }}>Apri</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mostrate.map(({ c, relazione, prev, daIncassare, opp }) => (
                  <tr key={c.id}>
                    <td>
                      <Link
                        href={`/clienti/${c.id}`}
                        style={st("display:flex;flex-direction:column;gap:4px")}
                      >
                        <span style={st("font-weight:600;color:#17150f")}>{c.nome}</span>
                        <span style={st("font-size:12px;color:#6b675c")}>
                          {[c.citta, c.pa ? "Pubblica amministrazione" : null]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </Link>
                    </td>
                    <td className="num">{c.partitaIva ?? c.codiceFiscale ?? "—"}</td>
                    <td>
                      <Tag tone={relazione === "cliente" ? "ink" : "blue"}>
                        {relazione === "cliente" ? "Cliente" : "Prospect"}
                      </Tag>
                    </td>
                    <td>
                      {opp[0]
                        ? `${opp[0].nome}${opp[0].fase ? ` · ${opp[0].fase.toLowerCase()}` : ""}`
                        : "—"}
                    </td>
                    <td className="r num">{prev}</td>
                    <td
                      className="r num"
                      style={{ fontWeight: 600, color: daIncassare > 0 ? "#8f3f1d" : "#3a372f" }}
                    >
                      {daIncassare > 0 ? formatEuro(daIncassare) : "—"}
                    </td>
                    <td className="r">
                      <Link
                        href={`/clienti/${c.id}`}
                        aria-label="Apri scheda cliente"
                        style={st(
                          "display:inline-grid;place-items:center;width:40px;height:40px;border-radius:50%;border:1px solid rgba(23,21,15,.16)",
                        )}
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div
          style={st(
            "display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;font-size:13px;color:#6b675c;border-top:1px solid rgba(23,21,15,.08);padding-top:16px",
          )}
        >
          <span>{mostrate.length} aziende mostrate · fonte: Twenty → Company, Opportunity</span>
        </div>
      </section>
    </>
  );
}

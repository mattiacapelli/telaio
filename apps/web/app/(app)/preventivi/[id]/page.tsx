import {
  formatAliquota,
  formatEuro,
  formattaNumero,
  prezzoVisualizzato,
  type RegoleFiscali,
  type StatoPreventivo,
  transizioniPreventivo,
} from "@telaio/core";
import { asc, eq, getDb, preventivi, preventivoRighe, ragioniSociali } from "@telaio/db";
import Link from "next/link";
import { notFound } from "next/navigation";
import { creaFatturaDaPreventivoAction } from "@/app/(app)/fatture/actions";
import { DetailBar } from "@/components/shell/topbar";
import { Tag } from "@/components/ui/tag";
import { formatData } from "@/lib/date";
import { STATO_PREVENTIVO } from "@/lib/stati";
import { st } from "@/lib/utils";
import { cambiaStatoPreventivoAction } from "./actions";

export const metadata = { title: "Preventivo" };
export const dynamic = "force-dynamic";

const AZIONE_STATO: Record<string, string> = {
  inviato: "Segna come inviato",
  in_revisione: "Metti in revisione",
  accettato: "Segna come accettato",
  rifiutato: "Segna come rifiutato",
  scaduto: "Segna come scaduto",
};

const TIPO = {
  una_tantum: "Una tantum",
  canone_annuo: "Canone annuo",
  canone_mensile: "Canone mensile",
} as const;

export default async function PreventivoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const db = getDb();
  const [p] = await db.select().from(preventivi).where(eq(preventivi.id, id));
  if (!p) notFound();
  const [righe, [rs]] = await Promise.all([
    db
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, id))
      .orderBy(asc(preventivoRighe.posizione)),
    db.select().from(ragioniSociali).where(eq(ragioniSociali.id, p.ragioneSocialeId)),
  ]);

  const regole = p.snapshot.regole as unknown as RegoleFiscali;
  const cliente = p.snapshot.cliente as {
    nome?: string;
    partitaIva?: string;
    codiceSdi?: string;
    citta?: string;
    pa?: boolean;
  };
  const stato = STATO_PREVENTIVO[p.stato];
  const somma = (t: keyof typeof TIPO) =>
    righe.filter((r) => r.tipo === t).reduce((s, r) => s + r.importoCent, 0);
  const canoneAnno = somma("canone_annuo") + somma("canone_mensile") * 12;
  const cAnno = prezzoVisualizzato(canoneAnno, regole);
  const primoNetto = p.imponibileCent + canoneAnno;
  const primoLordo = p.totaleCent + (cAnno.lordoCent ?? canoneAnno);
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const transizioni = transizioniPreventivo(p.stato as StatoPreventivo);

  const riga = (t: string, v: string, forte = false) => (
    <div
      className="row"
      style={{
        color: "rgba(244,243,240,.82)",
        ...(forte ? { fontWeight: 600, color: "#f4f3f0" } : {}),
      }}
    >
      <span>{t}</span>
      <span className="num">{v}</span>
    </div>
  );

  return (
    <>
      <DetailBar
        indietro={{ label: "Preventivi", href: "/preventivi" }}
        stato={
          <>
            <i
              style={st("width:7px;height:7px;border-radius:50%;background:#969184;display:block")}
            />
            {stato?.label ?? p.stato}
          </>
        }
      >
        {transizioni.map((nuovo) => (
          <form key={nuovo} action={cambiaStatoPreventivoAction}>
            <input type="hidden" name="id" value={p.id} />
            <input type="hidden" name="stato" value={nuovo} />
            <button
              type="submit"
              className={nuovo === "rifiutato" || nuovo === "scaduto" ? "bg sm bare" : "bp sm"}
            >
              {AZIONE_STATO[nuovo]}
            </button>
          </form>
        ))}
        {p.stato === "accettato" && (
          <form action={creaFatturaDaPreventivoAction}>
            <input type="hidden" name="preventivoId" value={p.id} />
            <button type="submit" className="bp sm">
              Converti in fattura <span aria-hidden="true">→</span>
            </button>
          </form>
        )}
        {transizioni.length === 0 && p.stato !== "accettato" && (
          <Link href="/preventivi" className="bg sm bare">
            Chiudi
          </Link>
        )}
      </DetailBar>

      <section
        style={st(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;align-items:end",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:14px")}>
          <span className="eb">03 — Preventivo da listino</span>
          <h1
            className="d num"
            style={st(
              "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
            )}
          >
            {p.numero ?? "Bozza"}
          </h1>
        </div>
        <p style={st("margin:0;max-width:46ch;font-size:16px;line-height:1.7;color:#3a372f")}>
          {p.oggetto}. L&apos;emittente decide numerazione, IBAN e IVA. Ogni prezzo è mostrato netto
          e, dove c&apos;è IVA, anche ivato.
        </p>
      </section>

      <section style={st("display:flex;flex-direction:column;gap:14px")}>
        <span className="eb">Emittente</span>
        <div
          style={st(
            "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px",
          )}
        >
          <div
            style={st(
              "display:flex;flex-direction:column;gap:10px;padding:20px 22px;border-radius:20px;background:#17150f;color:#f4f3f0",
            )}
          >
            <span
              style={st(
                "display:flex;justify-content:space-between;align-items:center;gap:12px;width:100%",
              )}
            >
              <span
                className="d"
                style={st("font-size:18px;font-weight:600;letter-spacing:-.01em")}
              >
                {(p.snapshot.emittente as { nome?: string }).nome}
              </span>
            </span>
            <span style={st("font-size:13px;opacity:.8")}>
              {rs ? rs.tipo.charAt(0).toUpperCase() + rs.tipo.slice(1).replace(/_/g, " ") : ""} ·
              es. {rs ? formattaNumero(rs.formatoPreventivo, 1, p.anno) : ""}
            </span>
            <span
              style={st(
                "align-self:flex-start;font:500 12px/1 Inter,sans-serif;padding:6px 10px;border-radius:999px;border:1px solid currentColor;opacity:.85",
              )}
            >
              {iva}
            </span>
          </div>
        </div>
      </section>

      <section
        style={st("display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px")}
      >
        <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
          <div
            style={st("display:flex;justify-content:space-between;align-items:baseline;gap:12px")}
          >
            <h2 className="h2">Cliente</h2>
            <span style={st("font-size:12px;color:#6b675c")}>da Twenty</span>
          </div>
          <dl style={st("margin:0;border-top:1px solid rgba(23,21,15,.14)")}>
            <div className="kv">
              <dt>Azienda</dt>
              <dd>{cliente.nome ?? "da assegnare"}</dd>
            </div>
            <div className="kv">
              <dt>P.IVA</dt>
              <dd className="num">{cliente.partitaIva ?? "—"}</dd>
            </div>
            <div className="kv">
              <dt>Codice SDI</dt>
              <dd className="num">{cliente.codiceSdi ?? "—"}</dd>
            </div>
            <div className="kv" style={{ borderBottom: 0 }}>
              <dt>Sede</dt>
              <dd>{cliente.citta ?? "—"}</dd>
            </div>
          </dl>
        </div>
        <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
          <h2 className="h2">Dettagli</h2>
          <dl style={st("margin:0;border-top:1px solid rgba(23,21,15,.14)")}>
            <div className="kv">
              <dt>Oggetto</dt>
              <dd>{p.oggetto}</dd>
            </div>
            <div className="kv">
              <dt>Data</dt>
              <dd className="num">{formatData(p.createdAt.toISOString())}</dd>
            </div>
            <div className="kv">
              <dt>Valido fino al</dt>
              <dd className="num">{formatData(p.validoFino)}</dd>
            </div>
            <div className="kv" style={{ borderBottom: 0 }}>
              <dt>Stato</dt>
              <dd>
                <Tag tone={stato?.tone}>{stato?.label ?? p.stato}</Tag>
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
        <div
          className="card"
          style={st("flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:18px")}
        >
          <h2 className="h2">Voci</h2>
          <div className="tw">
            <table className="tbl" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  <th>Voce</th>
                  <th>Tipo</th>
                  <th className="r">Una tantum</th>
                  <th className="r">Canone/anno</th>
                  <th className="r">Canone/mese</th>
                </tr>
              </thead>
              <tbody>
                {righe.map((r) => {
                  const v = prezzoVisualizzato(r.importoCent, regole);
                  const cella = (attiva: boolean, suffisso = "") =>
                    attiva ? (
                      <>
                        <span style={st("color:#17150f;font-weight:500")}>
                          {formatEuro(r.importoCent)}
                          {suffisso}
                        </span>
                        {v.lordoCent !== null && (
                          <span className="sub">{formatEuro(v.lordoCent)} ivato</span>
                        )}
                      </>
                    ) : (
                      "—"
                    );
                  return (
                    <tr key={r.id}>
                      <td style={st("color:#17150f;font-weight:500")}>{r.descrizione}</td>
                      <td>{TIPO[r.tipo]}</td>
                      <td className="r num">{cella(r.tipo === "una_tantum")}</td>
                      <td className="r num">{cella(r.tipo === "canone_annuo")}</td>
                      <td className="r num">{cella(r.tipo === "canone_mensile")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:stretch")}>
        <div
          className="ink"
          style={st("flex:1 1 420px;min-width:0;display:flex;flex-direction:column;gap:2px")}
        >
          <span
            style={st(
              "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7);margin-bottom:8px",
            )}
          >
            Riepilogo · {iva}
          </span>
          {riga("Una tantum netto", formatEuro(p.imponibileCent))}
          {regole.ivaAttiva && riga(iva, formatEuro(p.ivaCent))}
          {p.bolloCent > 0 && riga("Marca da bollo", formatEuro(p.bolloCent))}
          <div style={st("border-top:1px solid rgba(244,243,240,.16);margin:4px 0")} />
          {riga("Totale una tantum", formatEuro(p.totaleCent), true)}
          {canoneAnno > 0 && (
            <>
              <div style={{ height: 10 }} />
              {riga("Canone annuo netto", formatEuro(canoneAnno))}
              {cAnno.lordoCent !== null &&
                riga("Canone annuo IVA inclusa", formatEuro(cAnno.lordoCent))}
            </>
          )}
          <div
            style={st(
              "display:flex;flex-wrap:wrap;gap:24px;border-top:1px solid rgba(244,243,240,.16);padding-top:16px;margin-top:14px",
            )}
          >
            <div style={st("display:flex;flex-direction:column;gap:6px;flex:1 1 200px")}>
              <span style={st("font-size:13px;color:rgba(244,243,240,.78)")}>Primo anno netto</span>
              <b
                className="d num"
                style={st("font-size:32px;font-weight:600;letter-spacing:-.03em;line-height:1")}
              >
                {formatEuro(primoNetto)}
              </b>
            </div>
            {regole.ivaAttiva && (
              <div style={st("display:flex;flex-direction:column;gap:6px;flex:1 1 200px")}>
                <span style={st("font-size:13px;color:rgba(244,243,240,.78)")}>
                  Primo anno IVA inclusa
                </span>
                <b
                  className="d num"
                  style={st("font-size:32px;font-weight:600;letter-spacing:-.03em;line-height:1")}
                >
                  {formatEuro(primoLordo)}
                </b>
              </div>
            )}
          </div>
          {!regole.ivaAttiva && regole.diciturSenzaIva && (
            <p style={st("margin:12px 0 0;font-size:12px;color:rgba(244,243,240,.7)")}>
              {regole.diciturSenzaIva}
            </p>
          )}
        </div>
      </section>
    </>
  );
}

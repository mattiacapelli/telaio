import { formatAliquota, formatEuro, prezzoVisualizzato } from "@telaio/core";
import {
  asc,
  eq,
  getDb,
  isNull,
  listini,
  listinoBasi,
  listinoModuli,
  moduloBasi,
  ragioniSociali,
} from "@telaio/db";
import Link from "next/link";
import { TopBar } from "@/components/shell/topbar";
import { EmptyState } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatData } from "@/lib/date";
import { regoleDa } from "@/lib/regole";
import { cn, st } from "@/lib/utils";

export const metadata = { title: "Listini" };
export const dynamic = "force-dynamic";

const colonna = { borderLeft: "1px solid rgba(23,21,15,.08)" } as const;

export default async function ListiniPage({
  searchParams,
}: {
  searchParams: Promise<{ l?: string }>;
}) {
  const { l: scelto } = await searchParams;
  const db = getDb();
  const [elenco, basi, moduli, assegn] = await Promise.all([
    db
      .select({ l: listini, rs: ragioniSociali })
      .from(listini)
      .innerJoin(ragioniSociali, eq(ragioniSociali.id, listini.ragioneSocialeId))
      .where(isNull(listini.deletedAt))
      .orderBy(asc(listini.createdAt)),
    db
      .select()
      .from(listinoBasi)
      .where(isNull(listinoBasi.deletedAt))
      .orderBy(asc(listinoBasi.ordine)),
    db
      .select()
      .from(listinoModuli)
      .where(isNull(listinoModuli.deletedAt))
      .orderBy(asc(listinoModuli.ordine)),
    db.select().from(moduloBasi),
  ]);

  const corrente = elenco.find(({ l }) => l.id === scelto) ?? elenco[0];
  const voci = (id: string) =>
    basi.filter((b) => b.listinoId === id).length + moduli.filter((m) => m.listinoId === id).length;

  return (
    <>
      <TopBar links={[{ label: "Configuratore", href: "/configuratore" }]}>
        <Link href="/preventivi/nuovo" className="bp sm">
          Nuovo preventivo <span aria-hidden="true">→</span>
        </Link>
      </TopBar>

      <PageHeader
        numero="05"
        sezione="Listini"
        titolo="Listini"
        descrizione="Prezzo una tantum e canoni annuali o mensili per voce. Inserisci il netto: il prezzo con IVA lo calcola l'app con l'aliquota della ragione sociale che emette."
        azione={
          <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
            <Link href="/impostazioni/listini" className="bp sm">
              Modifica listini <span aria-hidden="true">+</span>
            </Link>
          </div>
        }
      />

      {elenco.length === 0 || !corrente ? (
        <EmptyState title="Nessun listino" />
      ) : (
        (() => {
          const { l, rs } = corrente;
          const regole = regoleDa(rs);
          const b = basi.filter((x) => x.listinoId === l.id);
          const m = moduli.filter((x) => x.listinoId === l.id);
          const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : null;
          const prezzo = (cent: number) => {
            if (cent === 0) return ["—", iva ? "—" : null] as const;
            const p = prezzoVisualizzato(cent, regole);
            return [
              formatEuro(p.nettoCent),
              p.lordoCent !== null ? formatEuro(p.lordoCent) : null,
            ] as const;
          };
          const righe = [
            ...b.map((v) => ({ v, tipo: "Base", compatibili: "" })),
            ...m.map((v) => ({
              v,
              tipo: "Add-on",
              compatibili: assegn
                .filter((a) => a.moduloId === v.id)
                .map((a) => b.find((x) => x.id === a.baseId)?.nome)
                .filter(Boolean)
                .join(", "),
            })),
          ];
          const ultimo = [...b, ...m].reduce<Date | null>(
            (a, x) => (!a || x.updatedAt > a ? x.updatedAt : a),
            null,
          );
          return (
            <section className="card" style={st("display:flex;flex-direction:column;gap:20px")}>
              <div
                role="tablist"
                aria-label="Listini"
                style={st(
                  "display:flex;flex-wrap:wrap;gap:24px;border-bottom:1px solid rgba(23,21,15,.14)",
                )}
              >
                {elenco.map(({ l: x }) => (
                  <Link
                    key={x.id}
                    href={`/listini?l=${x.id}`}
                    role="tab"
                    aria-selected={x.id === l.id}
                    className={cn("tab", x.id === l.id && "on")}
                    style={{ marginBottom: -1 }}
                  >
                    {x.nome} <b>{voci(x.id)}</b>
                  </Link>
                ))}
              </div>
              <div
                style={st(
                  "display:flex;flex-wrap:wrap;gap:12px 24px;justify-content:space-between;align-items:center",
                )}
              >
                <div style={st("display:flex;flex-wrap:wrap;gap:8px")}>
                  <span className="tag" style={{ fontSize: 11, padding: "5px 10px" }}>
                    {b.length} voc{b.length === 1 ? "e" : "i"} base
                  </span>
                  <span className="tag" style={{ fontSize: 11, padding: "5px 10px" }}>
                    {m.length} add-on
                  </span>
                  {ultimo && (
                    <span className="tag" style={{ fontSize: 11, padding: "5px 10px" }}>
                      Aggiornato {formatData(ultimo.toISOString())}
                    </span>
                  )}
                </div>
                <span style={st("font-size:13px;color:#3a372f")}>
                  Prezzi con IVA per <b>{rs.nome}</b> · {iva ?? "senza IVA"}
                </span>
              </div>
              {righe.length === 0 ? (
                <p style={st("margin:0;font-size:14px;color:#6b675c")}>
                  Listino vuoto: aggiungi le voci da Impostazioni → Listini.
                </p>
              ) : (
                <div className="tw">
                  <table className="tbl" style={{ minWidth: 1000 }}>
                    <thead>
                      <tr>
                        <th style={{ verticalAlign: "bottom" }}>Voce</th>
                        {["Una tantum", "Canone anno", "Canone mese"].map((t) => (
                          <th
                            key={t}
                            className="r"
                            style={{ ...colonna, verticalAlign: "bottom", whiteSpace: "normal" }}
                            colSpan={iva ? 2 : 1}
                          >
                            {t} netto{iva ? ` · con ${iva}` : ""}
                          </th>
                        ))}
                        <th style={colonna}>Descrizione</th>
                      </tr>
                    </thead>
                    <tbody>
                      {righe.map(({ v, tipo, compatibili }) => {
                        const celle = [
                          prezzo(v.unaTantumCent),
                          prezzo(v.canoneAnnuoCent),
                          prezzo(v.canoneMensileCent),
                        ];
                        return (
                          <tr key={v.id}>
                            <td>
                              <span style={st("font-weight:600;color:#17150f")}>{v.nome}</span>{" "}
                              <span
                                className="tag"
                                style={{ fontSize: 11, padding: "5px 10px", marginLeft: 6 }}
                              >
                                {tipo}
                              </span>
                              {compatibili && <span className="sub">per {compatibili}</span>}
                            </td>
                            {celle.map(([n, lordo], i) => (
                              <FragmentePrezzo key={i} netto={n} lordo={lordo} iva={!!iva} />
                            ))}
                            <td style={{ ...colonna, color: "#6b675c" }}>{v.descrizione ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          );
        })()
      )}

      <section
        style={st(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:32px;border-top:1px solid rgba(23,21,15,.14);padding-top:28px",
        )}
      >
        {[
          [
            "Base e add-on",
            "Una base è la voce di partenza; i moduli sono add-on. Il configuratore propone solo i moduli assegnati alla base scelta.",
          ],
          [
            "Prezzi netti",
            "Inserisci sempre il netto: il prezzo con IVA si calcola con l'aliquota della ragione sociale del listino.",
          ],
          [
            "Storico prezzi",
            "Cambiare un prezzo non tocca i preventivi già creati: ognuno conserva i valori del giorno in cui è stato creato.",
          ],
        ].map(([t, d]) => (
          <div key={t} style={st("display:flex;flex-direction:column;gap:10px")}>
            <span className="eb">{t}</span>
            <p style={st("margin:0;font-size:14px;line-height:1.6;color:#3a372f")}>{d}</p>
          </div>
        ))}
      </section>
    </>
  );
}

function FragmentePrezzo({
  netto,
  lordo,
  iva,
}: {
  netto: string;
  lordo: string | null;
  iva: boolean;
}) {
  return (
    <>
      <td className="r num" style={{ ...colonna, color: "#17150f", fontWeight: 500 }}>
        {netto}
      </td>
      {iva && (
        <td className="r num" style={{ color: "#6b675c" }}>
          {lordo ?? "—"}
        </td>
      )}
    </>
  );
}

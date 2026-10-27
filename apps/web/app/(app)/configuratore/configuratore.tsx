"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  formatEuroCompatto,
  moduliCompatibili,
  prezzoVisualizzato,
  type RegoleFiscali,
  totaliConfiguratore,
} from "@telaio/core";
import { useActionState, useMemo, useState } from "react";
import { initialState } from "@/components/ui/form-modal";
import { st } from "@/lib/utils";
import { creaPreventivoAction } from "./actions";

export interface VoceCfg {
  id: string;
  nome: string;
  descrizione: string | null;
  unaTantumCent: number;
  canoneAnnuoCent: number;
  canoneMensileCent: number;
}
export interface ListinoCfg {
  id: string;
  nome: string;
  ragioneSocialeId: string;
  ragioneSociale: string;
  regole: RegoleFiscali;
  basi: VoceCfg[];
  moduli: (VoceCfg & { baseIds: string[] })[];
}

function Prezzo({
  cent,
  regole,
  suffisso = "",
}: {
  cent: number;
  regole: RegoleFiscali;
  suffisso?: string;
}) {
  if (cent === 0) return null;
  const p = prezzoVisualizzato(cent, regole);
  return (
    <>
      {formatEuroCompatto(p.nettoCent)}
      {suffisso}
      {p.lordoCent !== null && <span className="pl">{formatEuroCompatto(p.lordoCent)} ivato</span>}
    </>
  );
}

const ON = "background:#17150f;color:#f4f3f0;border:1px solid #17150f";
const OFF = "background:rgba(255,255,255,.55);color:#17150f;border:1px solid rgba(23,21,15,.16)";
const INK_LABEL = "font:500 13px/1.2 Inter,sans-serif;color:rgba(244,243,240,.8)";
const INK_IN =
  "height:46px;padding:0 14px;border-radius:14px;border:1px solid rgba(244,243,240,.22);background:rgba(244,243,240,.08);color:#f4f3f0;font:400 15px Inter,sans-serif";

export function Configuratore({
  listini,
  clienti,
  clienteIniziale,
}: {
  listini: ListinoCfg[];
  clienti: { id: string; nome: string }[];
  clienteIniziale?: string;
}) {
  const [listinoId, setListinoId] = useState(listini[0]?.id ?? "");
  const [baseId, setBaseId] = useState("");
  const [moduloIds, setModuloIds] = useState<string[]>([]);
  const [stato, azione, pending] = useActionState(creaPreventivoAction, initialState);

  const listino = listini.find((l) => l.id === listinoId);
  const base = listino?.basi.find((b) => b.id === baseId);
  const compatibili = useMemo(
    () =>
      listino && baseId
        ? moduliCompatibili(
            baseId,
            listino.moduli.map((m) => ({ ...m, tipo: "modulo" as const })),
          )
        : [],
    [listino, baseId],
  );
  const descModulo = (id: string) => listino?.moduli.find((x) => x.id === id)?.descrizione;
  const scelti = compatibili.filter((m) => moduloIds.includes(m.id));
  const regole = listino?.regole;
  const voci = base ? [base, ...scelti] : [];
  const tot = totaliConfiguratore(voci.map((v) => ({ ...v, tipo: "base" as const })));
  const doc = regole
    ? calcolaTotali([{ quantita: 1, prezzoUnitarioCent: tot.unaTantumCent }], regole)
    : null;

  function scegliBase(id: string) {
    setBaseId(id);
    // Cambiando base restano selezionati solo i moduli ancora compatibili.
    setModuloIds((prev) =>
      prev.filter((m) => listino?.moduli.find((x) => x.id === m)?.baseIds.includes(id)),
    );
  }

  if (listini.length === 0) {
    return (
      <p className="card" style={st("margin:0;font-size:14px;color:#6b675c")}>
        Non ci sono listini: creane uno in Impostazioni → Listini e moduli.
      </p>
    );
  }

  const nVoci = voci.length;
  const riepilogo = () =>
    [
      `Offerta · ${listino?.ragioneSociale ?? ""}`,
      ...voci.map((v) => `- ${v.nome}`),
      `Una tantum netto: ${formatEuro(tot.unaTantumCent)}`,
      doc ? `Totale una tantum: ${formatEuro(doc.totaleCent)}` : "",
      tot.canoneAnnuoCent ? `Canone annuo netto: ${formatEuro(tot.canoneAnnuoCent)}` : "",
      tot.canoneMensileCent ? `Canone mensile netto: ${formatEuro(tot.canoneMensileCent)}` : "",
    ]
      .filter(Boolean)
      .join("\n");

  return (
    <form action={azione} style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
      <input type="hidden" name="ragioneSocialeId" value={listino?.ragioneSocialeId ?? ""} />
      <input type="hidden" name="baseId" value={baseId} />
      {moduloIds.map((m) => (
        <input key={m} type="hidden" name="moduloIds" value={m} />
      ))}

      <div style={st("flex:999 1 520px;min-width:0;display:flex;flex-direction:column;gap:20px")}>
        <div className="card" style={st("display:flex;flex-direction:column;gap:16px")}>
          <div style={st("display:flex;align-items:baseline;gap:14px")}>
            <span className="stepn">01</span>
            <h2 className="h2">Base</h2>
            <span style={st("font-size:13px;color:#6b675c")}>una sola scelta</span>
          </div>
          {listino && listino.basi.length === 0 && (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Questo listino non ha ancora basi.
            </p>
          )}
          <div
            role="radiogroup"
            aria-label="Base"
            style={st(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px",
            )}
          >
            {listino?.basi.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={b.id === baseId}
                className="opt"
                onClick={() => scegliBase(b.id)}
                style={st(b.id === baseId ? ON : OFF)}
              >
                <span
                  style={st(
                    "display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px",
                  )}
                >
                  <span className="d" style={st("font-size:17px;font-weight:600")}>
                    {b.nome}
                  </span>
                  <span
                    style={st(
                      "width:20px;height:20px;border-radius:50%;border:1.5px solid currentColor;display:grid;place-items:center",
                    )}
                  >
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        background: "currentColor",
                        opacity: b.id === baseId ? 1 : 0,
                      }}
                    />
                  </span>
                </span>
                {b.descrizione && (
                  <span style={st("font-size:13px;opacity:.8;line-height:1.5")}>
                    {b.descrizione}
                  </span>
                )}
                {regole && (
                  <span className="num" style={st("font-size:13px;font-weight:500")}>
                    <Prezzo cent={b.unaTantumCent} regole={regole} />
                    {b.canoneAnnuoCent > 0 && (
                      <>
                        {" "}
                        + <Prezzo cent={b.canoneAnnuoCent} regole={regole} suffisso="/anno" />
                      </>
                    )}
                    {b.canoneMensileCent > 0 && (
                      <>
                        {" "}
                        + <Prezzo cent={b.canoneMensileCent} regole={regole} suffisso="/mese" />
                      </>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={st("display:flex;flex-direction:column;gap:16px")}>
          <div style={st("display:flex;align-items:baseline;gap:14px")}>
            <span className="stepn">02</span>
            <h2 className="h2">Moduli</h2>
            <span style={st("font-size:13px;color:#6b675c")}>scelta multipla</span>
          </div>
          {!base ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Scegli una base: vedrai solo i moduli che la supportano.
            </p>
          ) : compatibili.length === 0 ? (
            <p style={st("margin:0;font-size:14px;color:#6b675c")}>
              Nessun modulo è assegnato a questa base.
            </p>
          ) : (
            <div
              style={st(
                "display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px",
              )}
            >
              {compatibili.map((m) => {
                const sel = moduloIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    className="opt"
                    aria-pressed={sel}
                    onClick={() =>
                      setModuloIds((p) => (sel ? p.filter((x) => x !== m.id) : [...p, m.id]))
                    }
                    style={st(sel ? ON : OFF)}
                  >
                    <span
                      style={st(
                        "display:flex;justify-content:space-between;align-items:center;width:100%;gap:10px",
                      )}
                    >
                      <span className="d" style={st("font-size:17px;font-weight:600")}>
                        {m.nome}
                      </span>
                      <span
                        style={st(
                          "width:20px;height:20px;border-radius:6px;border:1.5px solid currentColor;display:grid;place-items:center;font-size:13px;line-height:1",
                        )}
                      >
                        {sel ? "✓" : ""}
                      </span>
                    </span>
                    {descModulo(m.id) && (
                      <span style={st("font-size:13px;opacity:.8;line-height:1.5")}>
                        {descModulo(m.id)}
                      </span>
                    )}
                    {regole && (
                      <span className="num" style={st("font-size:13px;font-weight:500")}>
                        <Prezzo cent={m.unaTantumCent} regole={regole} />
                        {m.canoneAnnuoCent > 0 && (
                          <>
                            {" "}
                            + <Prezzo cent={m.canoneAnnuoCent} regole={regole} suffisso="/anno" />
                          </>
                        )}
                        {m.canoneMensileCent > 0 && (
                          <>
                            {" "}
                            + <Prezzo cent={m.canoneMensileCent} regole={regole} suffisso="/mese" />
                          </>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div
        className="ink"
        style={st("flex:1 1 340px;min-width:0;display:flex;flex-direction:column;gap:18px")}
        aria-live="polite"
      >
        <div style={st("display:flex;justify-content:space-between;align-items:center;gap:12px")}>
          <span
            style={st(
              "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7)",
            )}
          >
            La tua offerta
          </span>
          <span className="num" style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
            {nVoci} voc{nVoci === 1 ? "e" : "i"}
          </span>
        </div>
        <ul
          style={st(
            "list-style:none;margin:0;padding:0;display:flex;flex-direction:column;border-top:1px solid rgba(244,243,240,.16)",
          )}
        >
          {voci.length === 0 && (
            <li style={st("padding:11px 0;font-size:14px;color:rgba(244,243,240,.7)")}>
              Scegli una base per iniziare.
            </li>
          )}
          {voci.map((v) => (
            <li
              key={v.id}
              style={st(
                "display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid rgba(244,243,240,.1);font-size:14px",
              )}
            >
              <span style={st("color:rgba(244,243,240,.92)")}>{v.nome}</span>
              <span className="num" style={st("color:rgba(244,243,240,.75);text-align:right")}>
                {formatEuroCompatto(v.unaTantumCent || v.canoneAnnuoCent || v.canoneMensileCent)}
              </span>
            </li>
          ))}
        </ul>
        <div style={st("display:flex;flex-direction:column")}>
          <div className="row" style={{ color: "rgba(244,243,240,.8)" }}>
            <span>Una tantum netto</span>
            <span className="num">{formatEuro(tot.unaTantumCent)}</span>
          </div>
          {doc && regole?.ivaAttiva && (
            <div className="row" style={{ color: "rgba(244,243,240,.8)" }}>
              <span>IVA {formatAliquota(regole.aliquotaIvaBp)}</span>
              <span className="num">{formatEuro(doc.ivaCent)}</span>
            </div>
          )}
          {doc && doc.bolloCent > 0 && (
            <div className="row" style={{ color: "rgba(244,243,240,.8)" }}>
              <span>Marca da bollo</span>
              <span className="num">{formatEuro(doc.bolloCent)}</span>
            </div>
          )}
          <div className="row" style={{ color: "#f4f3f0", fontWeight: 600 }}>
            <span>Totale una tantum</span>
            <span className="num">{formatEuro(doc?.totaleCent ?? 0)}</span>
          </div>
          {(["Canone annuo", tot.canoneAnnuoCent] as const)[1] > 0 && (
            <div className="row" style={{ color: "rgba(244,243,240,.8)" }}>
              <span>Canone annuo netto</span>
              <span className="num">{formatEuro(tot.canoneAnnuoCent)}</span>
            </div>
          )}
          {tot.canoneMensileCent > 0 && (
            <div className="row" style={{ color: "rgba(244,243,240,.8)" }}>
              <span>Canone mensile netto</span>
              <span className="num">{formatEuro(tot.canoneMensileCent)}</span>
            </div>
          )}
        </div>
        <div
          style={st(
            "display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;border-top:1px solid rgba(244,243,240,.16);padding-top:18px",
          )}
        >
          <div style={st("display:flex;flex-direction:column;gap:6px")}>
            <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>Primo anno netto</span>
            <b
              className="d num"
              style={st(
                "font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1;color:#f4f3f0",
              )}
            >
              {formatEuro(tot.unaTantumCent + tot.canoneAnnuoCent + tot.canoneMensileCent * 12)}
            </b>
          </div>
          {doc && regole?.ivaAttiva && (
            <div style={st("display:flex;flex-direction:column;gap:6px")}>
              <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
                Primo anno IVA inclusa
              </span>
              <b
                className="d num"
                style={st(
                  "font-size:30px;font-weight:600;letter-spacing:-.03em;line-height:1;color:#f4f3f0",
                )}
              >
                {formatEuro(
                  doc.totaleCent +
                    calcolaTotali(
                      [
                        {
                          quantita: 1,
                          prezzoUnitarioCent: tot.canoneAnnuoCent + tot.canoneMensileCent * 12,
                        },
                      ],
                      regole,
                    ).totaleCent,
                )}
              </b>
            </div>
          )}
        </div>
        {regole && !regole.ivaAttiva && regole.diciturSenzaIva && (
          <span style={st("font-size:13px;color:rgba(244,243,240,.75)")}>
            {regole.diciturSenzaIva}
          </span>
        )}
        <div
          style={st(
            "display:flex;flex-direction:column;gap:10px;border-top:1px solid rgba(244,243,240,.16);padding-top:18px",
          )}
        >
          <label htmlFor="cfg-cli" style={st(INK_LABEL)}>
            Per il cliente
          </label>
          <select
            id="cfg-cli"
            name="clienteTwentyId"
            defaultValue={clienteIniziale ?? ""}
            style={st(INK_IN)}
          >
            <option value="">Da assegnare</option>
            {clienti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
          <label htmlFor="cfg-em" style={st(INK_LABEL)}>
            Emesso da · listino
          </label>
          <select
            id="cfg-em"
            value={listinoId}
            onChange={(e) => {
              setListinoId(e.target.value);
              setBaseId("");
              setModuloIds([]);
            }}
            style={st(INK_IN)}
          >
            {listini.map((l) => (
              <option key={l.id} value={l.id}>
                {l.ragioneSociale} · {l.nome} ·{" "}
                {l.regole.ivaAttiva ? `IVA ${formatAliquota(l.regole.aliquotaIvaBp)}` : "senza IVA"}
              </option>
            ))}
          </select>
          <label htmlFor="cfg-og" style={st(INK_LABEL)}>
            Oggetto (facoltativo)
          </label>
          <input
            id="cfg-og"
            name="oggetto"
            placeholder="Se vuoto usa il nome della base"
            style={st(INK_IN)}
          />
        </div>
        {stato.message && (
          <p
            role="alert"
            style={st(
              "margin:0;padding:12px 16px;border-radius:14px;background:rgba(180,83,42,.35);font-size:14px",
            )}
          >
            {stato.message}
          </p>
        )}
        <button
          type="submit"
          disabled={!base || pending}
          style={{
            display: "inline-flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 8,
            minHeight: 50,
            borderRadius: 999,
            background: "#f4f3f0",
            color: "#17150f",
            font: "500 15px/1 Inter,sans-serif",
            border: 0,
            cursor: "pointer",
            opacity: !base || pending ? 0.5 : 1,
          }}
        >
          {pending ? "Creazione…" : "Crea preventivo"} <span aria-hidden="true">→</span>
        </button>
        <button
          type="button"
          onClick={() => navigator.clipboard?.writeText(riepilogo())}
          disabled={!base}
          style={{
            minHeight: 44,
            borderRadius: 999,
            border: "1px solid rgba(244,243,240,.28)",
            background: "none",
            color: "rgba(244,243,240,.9)",
            font: "500 14px/1 Inter,sans-serif",
            cursor: "pointer",
            opacity: base ? 1 : 0.5,
          }}
        >
          Copia riepilogo per WhatsApp / email
        </button>
      </div>
    </form>
  );
}

"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  moduliCompatibili,
  prezzoVisualizzato,
  totaliConfiguratore,
} from "@telaio/core";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { creaPreventivoAction } from "@/app/(app)/configuratore/actions";
import type { ListinoCfg } from "@/app/(app)/configuratore/configuratore";
import { DetailBar } from "@/components/shell/topbar";
import { initialState } from "@/components/ui/form-modal";
import { cn, st } from "@/lib/utils";

const SCONTI = [0, 5, 10, 15];
const VALIDITA = [15, 30, 60, 90];

/** Editor del preventivo da listino: emittente, cliente, voci, sconto e riepilogo. */
export function PreventivoEditor({
  listini,
  clienti,
  clienteIniziale,
}: {
  listini: ListinoCfg[];
  clienti: { id: string; nome: string }[];
  clienteIniziale?: string;
}) {
  const [stato, azione, pending] = useActionState(creaPreventivoAction, initialState);
  const [listinoId, setListinoId] = useState(listini[0]?.id ?? "");
  const [baseId, setBaseId] = useState("");
  const [moduloIds, setModuloIds] = useState<string[]>([]);
  const [sconto, setSconto] = useState(0);
  const [validita, setValidita] = useState(30);

  const listino = listini.find((l) => l.id === listinoId);
  const regole = listino?.regole;
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
  const scelti = compatibili.filter((m) => moduloIds.includes(m.id));
  const voci = base ? [base, ...scelti] : [];
  const tot = totaliConfiguratore(voci.map((v) => ({ ...v, tipo: "base" as const })));
  const scontoCent = Math.round((tot.unaTantumCent * sconto) / 100);
  const doc = regole
    ? calcolaTotali(
        [{ quantita: 1, prezzoUnitarioCent: tot.unaTantumCent, scontoBp: sconto * 100 }],
        regole,
      )
    : null;
  const canoneAnno = tot.canoneAnnuoCent + tot.canoneMensileCent * 12;
  const canoneV = regole ? prezzoVisualizzato(canoneAnno, regole) : null;
  const iva = regole?.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const primoNetto = (doc?.imponibileCent ?? 0) + canoneAnno;
  const primoLordo = (doc?.totaleCent ?? 0) + (canoneV?.lordoCent ?? canoneAnno);

  function cambiaListino(id: string) {
    setListinoId(id);
    setBaseId("");
    setModuloIds([]);
  }

  const riga = (t: string, v: string, forte = false) => (
    <div
      className="row"
      style={{ color: forte ? "#f4f3f0" : "rgba(244,243,240,.82)", fontWeight: forte ? 600 : 400 }}
    >
      <span>{t}</span>
      <span className="num">{v}</span>
    </div>
  );

  if (listini.length === 0) {
    return (
      <p className="card" style={st("margin:0;font-size:14px;color:#6b675c")}>
        Non ci sono listini: creane uno in Impostazioni → Listini e moduli.
      </p>
    );
  }

  return (
    <form action={azione} style={{ display: "contents" }}>
      <input type="hidden" name="ragioneSocialeId" value={listino?.ragioneSocialeId ?? ""} />
      <input type="hidden" name="baseId" value={baseId} />
      <input type="hidden" name="scontoBp" value={sconto * 100} />
      <input type="hidden" name="validitaGiorni" value={validita} />
      {moduloIds.map((m) => (
        <input key={m} type="hidden" name="moduloIds" value={m} />
      ))}

      <DetailBar
        indietro={{ label: "Preventivi", href: "/preventivi" }}
        stato={
          <>
            <i
              style={st("width:7px;height:7px;border-radius:50%;background:#969184;display:block")}
            />
            Nuova bozza
          </>
        }
      >
        <Link href="/configuratore" className="bg sm bare">
          Configuratore rapido
        </Link>
        <button type="submit" className="bp sm" disabled={!base || pending}>
          {pending ? "Creazione…" : "Salva bozza"} <span aria-hidden="true">→</span>
        </button>
      </DetailBar>

      <section
        style={st(
          "display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px;align-items:end",
        )}
      >
        <div style={st("display:flex;flex-direction:column;gap:14px")}>
          <span className="eb">03 — Preventivo da listino</span>
          <h1
            className="d"
            style={st(
              "margin:0;font-weight:500;font-size:clamp(2.4rem,4.4vw,3.8rem);line-height:1.04;letter-spacing:-.032em",
            )}
          >
            Nuovo preventivo
          </h1>
        </div>
        <p style={st("margin:0;max-width:46ch;font-size:16px;line-height:1.7;color:#3a372f")}>
          L&apos;emittente decide numerazione, IBAN e IVA. Ogni prezzo è mostrato netto e, dove
          c&apos;è IVA, anche ivato. Il numero arriva quando lo invii al cliente.
        </p>
      </section>

      {stato.message && (
        <p
          role="alert"
          style={st(
            "margin:0;padding:14px 18px;border-radius:16px;background:#17150f;color:#f4f3f0;font-size:15px",
          )}
        >
          {stato.message}
        </p>
      )}

      <section style={st("display:flex;flex-direction:column;gap:14px")}>
        <span className="eb">Emittente</span>
        <div
          role="radiogroup"
          aria-label="Ragione sociale emittente"
          style={st(
            "display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px",
          )}
        >
          {listini.map((l) => {
            const on = l.id === listinoId;
            return (
              <button
                key={l.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => cambiaListino(l.id)}
                style={{
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  padding: "20px 22px",
                  borderRadius: 20,
                  fontFamily: "Inter, sans-serif",
                  ...(on
                    ? st("background:#17150f;color:#f4f3f0;border:1px solid #17150f")
                    : st(
                        "background:rgba(255,255,255,.55);color:#17150f;border:1px solid rgba(23,21,15,.16)",
                      )),
                }}
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
                    {l.ragioneSociale}
                  </span>
                  <span
                    style={st(
                      "width:18px;height:18px;border-radius:50%;border:1.5px solid currentColor;display:grid;place-items:center;flex:none",
                    )}
                  >
                    {on && (
                      <span
                        style={st(
                          "width:8px;height:8px;border-radius:50%;background:currentColor;display:block",
                        )}
                      />
                    )}
                  </span>
                </span>
                <span style={st("font-size:13px;opacity:.8")}>Listino {l.nome}</span>
                <span
                  style={st(
                    "align-self:flex-start;font:500 12px/1 Inter,sans-serif;padding:6px 10px;border-radius:999px;border:1px solid currentColor;opacity:.85",
                  )}
                >
                  {l.regole.ivaAttiva
                    ? `IVA ${formatAliquota(l.regole.aliquotaIvaBp)}`
                    : "Senza IVA"}
                </span>
              </button>
            );
          })}
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
          <div className="f">
            <label className="lbl" htmlFor="pe-cli">
              Azienda
            </label>
            <select
              id="pe-cli"
              name="clienteTwentyId"
              className="in"
              defaultValue={clienteIniziale ?? ""}
            >
              <option value="">Da assegnare</option>
              {clienti.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="card" style={st("display:flex;flex-direction:column;gap:14px")}>
          <h2 className="h2">Dettagli</h2>
          <div className="f">
            <label className="lbl" htmlFor="pe-og">
              Oggetto
            </label>
            <input
              id="pe-og"
              name="oggetto"
              className="in"
              placeholder="Se vuoto usa il nome della base"
            />
          </div>
          <div className="f">
            <label className="lbl" htmlFor="pe-val">
              Validità
            </label>
            <select
              id="pe-val"
              className="in"
              value={validita}
              onChange={(e) => setValidita(Number(e.target.value))}
            >
              {VALIDITA.map((g) => (
                <option key={g} value={g}>
                  {g} giorni
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section style={st("display:flex;flex-wrap:wrap;gap:20px;align-items:flex-start")}>
        <div
          className="card"
          style={st("flex:999 1 560px;min-width:0;display:flex;flex-direction:column;gap:18px")}
        >
          <div
            style={st(
              "display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:12px",
            )}
          >
            <h2 className="h2">Voci</h2>
            <span style={st("font-size:13px;color:#6b675c")}>
              una base, poi i moduli compatibili
            </span>
          </div>

          <div
            role="radiogroup"
            aria-label="Base"
            style={st(
              "display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px",
            )}
          >
            {listino?.basi.map((b) => {
              const on = b.id === baseId;
              return (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className="opt"
                  onClick={() => {
                    setBaseId(b.id);
                    setModuloIds((p) =>
                      p.filter((m) =>
                        listino.moduli.find((x) => x.id === m)?.baseIds.includes(b.id),
                      ),
                    );
                  }}
                  style={
                    on
                      ? st("background:#17150f;color:#f4f3f0;border:1px solid #17150f")
                      : st(
                          "background:rgba(255,255,255,.55);color:#17150f;border:1px solid rgba(23,21,15,.16)",
                        )
                  }
                >
                  <span className="d" style={st("font-size:17px;font-weight:600")}>
                    {b.nome}
                  </span>
                  <span className="num" style={st("font-size:13px;font-weight:500")}>
                    {formatEuro(b.unaTantumCent)}
                    {b.canoneAnnuoCent > 0 && ` + ${formatEuro(b.canoneAnnuoCent)}/anno`}
                    {b.canoneMensileCent > 0 && ` + ${formatEuro(b.canoneMensileCent)}/mese`}
                  </span>
                </button>
              );
            })}
          </div>

          {base && (
            <div
              style={st(
                "display:flex;flex-direction:column;border-top:1px solid rgba(23,21,15,.14)",
              )}
            >
              {compatibili.length === 0 && (
                <p style={st("margin:14px 0 0;font-size:14px;color:#6b675c")}>
                  Nessun modulo è assegnato a questa base.
                </p>
              )}
              {compatibili.map((m) => {
                const on = moduloIds.includes(m.id);
                const v = regole
                  ? prezzoVisualizzato(
                      m.unaTantumCent || m.canoneAnnuoCent || m.canoneMensileCent,
                      regole,
                    )
                  : null;
                return (
                  <div
                    key={m.id}
                    style={st(
                      "display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid rgba(23,21,15,.08)",
                    )}
                  >
                    <div style={st("flex:1;display:flex;flex-direction:column;gap:3px")}>
                      <span style={st("font-weight:600")}>{m.nome}</span>
                      <span className="sub num" style={{ marginTop: 0 }}>
                        {formatEuro(m.unaTantumCent)}
                        {v?.lordoCent != null &&
                          m.unaTantumCent > 0 &&
                          ` · ${formatEuro(v.lordoCent)} ivato`}
                        {m.canoneAnnuoCent > 0 && ` · ${formatEuro(m.canoneAnnuoCent)}/a`}
                        {m.canoneMensileCent > 0 && ` · ${formatEuro(m.canoneMensileCent)}/m`}
                      </span>
                    </div>
                    <button
                      type="button"
                      aria-pressed={on}
                      aria-label={on ? `Rimuovi ${m.nome}` : `Aggiungi ${m.nome}`}
                      onClick={() =>
                        setModuloIds((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))
                      }
                      className={cn("step", on && "on")}
                      style={on ? st("background:#17150f;color:#f4f3f0") : undefined}
                    >
                      {on ? "−" : "+"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div
            style={st(
              "display:flex;flex-wrap:wrap;align-items:center;gap:12px;border-top:1px solid rgba(23,21,15,.08);padding-top:16px",
            )}
          >
            <span style={st("font-size:14px;color:#3a372f")}>Sconto una tantum</span>
            <div role="group" aria-label="Sconto" style={st("display:flex;flex-wrap:wrap;gap:8px")}>
              {SCONTI.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn("chip", sconto === s && "on")}
                  onClick={() => setSconto(s)}
                >
                  {s === 0 ? "Nessuno" : `${s}%`}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        className="ink"
        style={st("display:flex;flex-direction:column;gap:2px")}
        aria-live="polite"
      >
        <span
          style={st(
            "font:500 11px/1.2 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(244,243,240,.7);margin-bottom:8px",
          )}
        >
          Riepilogo · {iva}
        </span>
        {riga("Una tantum netto", formatEuro(tot.unaTantumCent))}
        {sconto > 0 && riga(`Sconto ${sconto}%`, `− ${formatEuro(scontoCent)}`)}
        {regole?.ivaAttiva && doc && riga(iva, formatEuro(doc.ivaCent))}
        {doc && doc.bolloCent > 0 && riga("Marca da bollo", formatEuro(doc.bolloCent))}
        <div style={st("border-top:1px solid rgba(244,243,240,.16);margin:4px 0")} />
        {riga("Totale una tantum", formatEuro(doc?.totaleCent ?? 0), true)}
        {canoneAnno > 0 && (
          <>
            <div style={{ height: 10 }} />
            {riga("Canone annuo netto", formatEuro(canoneAnno))}
            {canoneV?.lordoCent != null &&
              riga("Canone annuo IVA inclusa", formatEuro(canoneV.lordoCent))}
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
          {regole?.ivaAttiva && (
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
        {regole && !regole.ivaAttiva && regole.diciturSenzaIva && (
          <p style={st("margin:12px 0 0;font-size:12px;color:rgba(244,243,240,.7)")}>
            {regole.diciturSenzaIva}
          </p>
        )}
      </section>
    </form>
  );
}

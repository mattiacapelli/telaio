"use client";

import { type RegoleFiscali, calcolaTotali, formatAliquota, formatEuro, moduliCompatibili, prezzoVisualizzato, totaliConfiguratore } from "@telaio/core";
import { useActionState, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { cn } from "@/lib/utils";
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

function Importo({ cent, regole, suffisso = "" }: { cent: number; regole: RegoleFiscali; suffisso?: string }) {
  if (cent === 0) return <span className="text-muted">—</span>;
  const p = prezzoVisualizzato(cent, regole);
  return (
    <span className="tabular-nums">
      {formatEuro(p.nettoCent)}
      {suffisso}
      {p.lordoCent !== null && <span className="block text-xs text-muted">{formatEuro(p.lordoCent)} con IVA</span>}
    </span>
  );
}

export function Configuratore({ listini, clienti, clienteIniziale }: { listini: ListinoCfg[]; clienti: { id: string; nome: string }[]; clienteIniziale?: string }) {
  const [listinoId, setListinoId] = useState(listini[0]?.id ?? "");
  const [baseId, setBaseId] = useState("");
  const [moduloIds, setModuloIds] = useState<string[]>([]);
  const [stato, azione, pending] = useActionState(creaPreventivoAction, initialState);

  const listino = listini.find((l) => l.id === listinoId);
  const base = listino?.basi.find((b) => b.id === baseId);
  const compatibili = useMemo(
    () =>
      listino && baseId
        ? moduliCompatibili(baseId, listino.moduli.map((m) => ({ ...m, tipo: "modulo" as const })))
        : [],
    [listino, baseId],
  );
  const scelti = compatibili.filter((m) => moduloIds.includes(m.id));
  const regole = listino?.regole;
  const voci = base ? [base, ...scelti] : [];
  const tot = totaliConfiguratore(voci.map((v) => ({ ...v, tipo: "base" as const })));
  const doc = regole ? calcolaTotali([{ quantita: 1, prezzoUnitarioCent: tot.unaTantumCent }], regole) : null;

  function scegliBase(id: string) {
    setBaseId(id);
    // Cambiando base restano selezionati solo i moduli ancora compatibili.
    setModuloIds((prev) => prev.filter((m) => listino?.moduli.find((x) => x.id === m)?.baseIds.includes(id)));
  }

  if (listini.length === 0) {
    return <p className="glass-card p-6 text-sm text-muted">Non ci sono listini: creane uno in Impostazioni → Listini e moduli.</p>;
  }

  return (
    <form action={azione} className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <input type="hidden" name="ragioneSocialeId" value={listino?.ragioneSocialeId ?? ""} />
      <input type="hidden" name="baseId" value={baseId} />
      {moduloIds.map((m) => <input key={m} type="hidden" name="moduloIds" value={m} />)}

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-4">
          <p className="eyebrow">Passo 1 — Listino e cliente</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Listino">
              <Select value={listinoId} onChange={(e) => { setListinoId(e.target.value); setBaseId(""); setModuloIds([]); }}>
                {listini.map((l) => <option key={l.id} value={l.id}>{l.nome} · {l.ragioneSociale}</option>)}
              </Select>
            </Field>
            <Field label="Cliente (da Twenty)" hint="Puoi assegnarlo anche dopo">
              <Select name="clienteTwentyId" defaultValue={clienteIniziale ?? ""}>
                <option value="">Da assegnare</option>
                {clienti.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Oggetto del preventivo" hint="Se vuoto usa il nome della base"><Input name="oggetto" /></Field>
        </section>

        <section className="flex flex-col gap-4">
          <p className="eyebrow">Passo 2 — Base</p>
          {listino && listino.basi.length === 0 && <p className="text-sm text-muted">Questo listino non ha ancora basi.</p>}
          <div role="radiogroup" aria-label="Base" className="grid gap-3 sm:grid-cols-2">
            {listino?.basi.map((b) => (
              <button
                key={b.id}
                type="button"
                role="radio"
                aria-checked={b.id === baseId}
                onClick={() => scegliBase(b.id)}
                className={cn("glass-card min-h-11 p-5 text-left transition-shadow", b.id === baseId && "outline-2 outline-ink")}
              >
                <p className="font-display text-lg font-semibold">{b.nome}</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted">
                  <span>Una tantum<br /><span className="text-sm text-ink">{regole && <Importo cent={b.unaTantumCent} regole={regole} />}</span></span>
                  <span>Anno<br /><span className="text-sm text-ink">{regole && <Importo cent={b.canoneAnnuoCent} regole={regole} />}</span></span>
                  <span>Mese<br /><span className="text-sm text-ink">{regole && <Importo cent={b.canoneMensileCent} regole={regole} />}</span></span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <p className="eyebrow">Passo 3 — Moduli compatibili</p>
          {!base ? (
            <p className="text-sm text-muted">Scegli una base: vedrai solo i moduli che la supportano.</p>
          ) : compatibili.length === 0 ? (
            <p className="text-sm text-muted">Nessun modulo è assegnato a questa base.</p>
          ) : (
            <ul className="grid gap-3">
              {compatibili.map((m) => {
                const sel = moduloIds.includes(m.id);
                return (
                  <li key={m.id}>
                    <label className={cn("glass-card flex min-h-11 cursor-pointer items-center gap-4 p-4", sel && "outline-2 outline-ink")}>
                      <input
                        type="checkbox"
                        checked={sel}
                        onChange={() => setModuloIds((p) => (sel ? p.filter((x) => x !== m.id) : [...p, m.id]))}
                        className="size-5 accent-[var(--ink)]"
                      />
                      <span className="flex-1 font-medium">{m.nome}</span>
                      <span className="grid grid-cols-3 gap-4 text-right text-sm">
                        {regole && <><Importo cent={m.unaTantumCent} regole={regole} /><Importo cent={m.canoneAnnuoCent} regole={regole} suffisso="/a" /><Importo cent={m.canoneMensileCent} regole={regole} suffisso="/m" /></>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <aside className="ink-panel h-fit p-6 lg:sticky lg:top-8" aria-live="polite">
        <p className="eyebrow !text-grey-2">Riepilogo</p>
        <p className="mt-2 font-display text-xl font-semibold">{base?.nome ?? "Nessuna base"}</p>
        {scelti.length > 0 && <p className="text-sm text-grey-2">+ {scelti.map((m) => m.nome).join(", ")}</p>}
        <dl className="mt-5 flex flex-col gap-2 text-sm tabular-nums">
          <div className="flex justify-between"><dt>Una tantum (netto)</dt><dd>{formatEuro(tot.unaTantumCent)}</dd></div>
          {doc && regole?.ivaAttiva && <div className="flex justify-between"><dt>IVA {formatAliquota(regole.aliquotaIvaBp)}</dt><dd>{formatEuro(doc.ivaCent)}</dd></div>}
          {doc && doc.bolloCent > 0 && <div className="flex justify-between"><dt>Bollo</dt><dd>{formatEuro(doc.bolloCent)}</dd></div>}
          <div className="flex items-baseline justify-between border-t border-white/20 pt-3">
            <dt>Totale una tantum</dt><dd className="money text-3xl font-semibold">{formatEuro(doc?.totaleCent ?? 0)}</dd>
          </div>
          {regole && !regole.ivaAttiva && regole.diciturSenzaIva && <p className="text-xs text-grey-2">{regole.diciturSenzaIva}</p>}
        </dl>
        <dl className="mt-5 flex flex-col gap-2 border-t border-white/20 pt-4 text-sm tabular-nums">
          {(
            [
              ["Canone annuo", tot.canoneAnnuoCent],
              ["Canone mensile", tot.canoneMensileCent],
            ] as const
          ).map(([k, v]) => {
            const p = regole ? prezzoVisualizzato(v, regole) : null;
            return (
              <div key={k} className="flex justify-between">
                <dt>{k}</dt>
                <dd className="text-right">{formatEuro(v)}{p?.lordoCent != null && <span className="block text-xs text-grey-2">{formatEuro(p.lordoCent)} con IVA</span>}</dd>
              </div>
            );
          })}
        </dl>
        {stato.message && <p role="alert" className="mt-4 rounded-2xl bg-orange/30 px-4 py-3 text-sm">{stato.message}</p>}
        <Button type="submit" variant="glass" className="mt-6 w-full" disabled={!base || pending}>
          {pending ? "Creazione…" : "Crea preventivo"}
        </Button>
        <p className="mt-2 text-center text-xs text-grey-2">Nasce come bozza, senza numero.</p>
      </aside>
    </form>
  );
}

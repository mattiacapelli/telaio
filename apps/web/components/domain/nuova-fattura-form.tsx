"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  parseEuro,
  type RegoleFiscali,
} from "@telaio/core";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { salvaFatturaLiberaAction } from "@/app/(app)/fatture/actions";
import { Button } from "@/components/ui/button";
import { Card, InkPanel } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { cn } from "@/lib/utils";

interface Emittente {
  id: string;
  nome: string;
  sezionale: string;
  regole: RegoleFiscali;
}
interface Opt {
  id: string;
  nome: string;
}
interface Conto extends Opt {
  ragioneSocialeId: string | null;
}
interface Voce extends Opt {
  prezzoCent: number;
}
interface Riga {
  k: number;
  d: string;
  q: string;
  p: string;
}

type Modo = "twenty" | "occasionale" | "privato";
const MODI: { id: Modo; label: string }[] = [
  { id: "twenty", label: "Azienda in Twenty" },
  { id: "occasionale", label: "Azienda occasionale" },
  { id: "privato", label: "Privato" },
];
const METODI = ["bonifico", "contanti", "carta"] as const;
const SCADENZE = [
  { giorni: 30, label: "30 giorni data fattura" },
  { giorni: 0, label: "A vista" },
  { giorni: 60, label: "60 giorni" },
  { giorni: 90, label: "90 giorni" },
];

function Segmenti<T extends string>({
  etichetta,
  opzioni,
  valore,
  onChange,
  className,
}: {
  etichetta: string;
  opzioni: { id: T; label: string }[];
  valore: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etichetta}
      className={cn("flex gap-1 rounded-full border border-ink/16 bg-white/60 p-1", className)}
    >
      {opzioni.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valore === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "min-h-11 flex-1 rounded-full text-[13px] leading-none font-medium",
            valore === o.id ? "bg-ink text-paper" : "text-ink-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Etichetta = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[13px] leading-tight font-medium text-ink-2">{children}</span>
);

export function NuovaFatturaForm({
  emittenti,
  clienti,
  conti,
  voci,
}: {
  emittenti: Emittente[];
  clienti: Opt[];
  conti: Conto[];
  voci: Voce[];
}) {
  const [state, azione, inCorso] = useActionState(salvaFatturaLiberaAction, initialState);
  const [emId, setEmId] = useState(emittenti[0]?.id ?? "");
  const [modo, setModo] = useState<Modo>("twenty");
  const [righe, setRighe] = useState<Riga[]>([{ k: 1, d: "", q: "1", p: "" }]);
  const [incassata, setIncassata] = useState(false);
  const [metodo, setMetodo] = useState<(typeof METODI)[number]>("bonifico");
  const [prossimaK, setProssimaK] = useState(2);

  const em = emittenti.find((e) => e.id === emId);
  const contiEm = conti.filter((c) => !c.ragioneSocialeId || c.ragioneSocialeId === emId);

  const totali = useMemo(() => {
    if (!em) return null;
    return calcolaTotali(
      righe.map((r) => ({
        quantita: Math.max(0, Number.parseInt(r.q, 10) || 0),
        prezzoUnitarioCent: parseEuro(r.p) ?? 0,
        scontoBp: 0,
      })),
      em.regole,
    );
  }, [righe, em]);

  const aggiorna = (k: number, campo: "d" | "q" | "p", v: string) =>
    setRighe((rs) => rs.map((r) => (r.k === k ? { ...r, [campo]: v } : r)));
  const aggiungi = (d = "", p = "") => {
    setRighe((rs) => [...rs, { k: prossimaK, d, q: "1", p }]);
    setProssimaK((n) => n + 1);
  };

  const righeJson = JSON.stringify(
    righe
      .filter((r) => r.d.trim())
      .map((r) => ({ d: r.d, q: Number.parseInt(r.q, 10) || 0, p: r.p, s: "" })),
  );

  return (
    <form action={azione} className="contents">
      <input type="hidden" name="righe" value={righeJson} />
      <input type="hidden" name="modo" value={modo} />
      <input type="hidden" name="ragioneSocialeId" value={emId} />
      <input type="hidden" name="metodo" value={metodo} />
      {incassata && <input type="hidden" name="incassata" value="on" />}

      <header className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/fatture"
          className="glass-pill flex min-h-13 items-center gap-3 px-[18px] text-[15px] font-medium"
        >
          <span aria-hidden>←</span> Fatture
        </Link>
        <div className="glass-pill flex min-h-13 items-center gap-3 px-[18px] text-sm text-ink-2">
          <i aria-hidden className="block size-[7px] rounded-full bg-grey-1" />
          Bozza
        </div>
        <div className="glass-pill flex min-h-13 items-center gap-1.5 pr-1.5 pl-1.5">
          <Button
            type="submit"
            name="azione"
            value="bozza"
            variant="ghost"
            size="sm"
            disabled={inCorso}
          >
            Salva bozza
          </Button>
          <Button type="submit" name="azione" value="emetti" size="sm" disabled={inCorso}>
            Emetti fattura <span aria-hidden>→</span>
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] items-end gap-6">
        <div className="flex flex-col gap-3.5">
          <span className="eyebrow">06 — Fattura libera</span>
          <h1 className="font-display text-[clamp(2.4rem,4.4vw,3.8rem)] leading-[1.04] font-medium tracking-[-0.032em]">
            Nuova fattura
          </h1>
        </div>
        <p className="max-w-[46ch] text-base leading-[1.7] text-ink-2">
          Nessun preventivo, nessuna rata: scrivi le righe a mano o pescale dal listino. Il cliente
          può essere in Twenty, occasionale o un privato. Il numero arriva solo all&apos;emissione.
        </p>
      </section>

      {state.message && !state.ok && (
        <p role="alert" className="rounded-2xl bg-ink px-[18px] py-3.5 text-[15px] text-paper">
          {state.message}
        </p>
      )}

      <section className="flex flex-col gap-3.5">
        <span className="eyebrow">Emittente</span>
        <div
          role="radiogroup"
          aria-label="Ragione sociale emittente"
          className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3"
        >
          {emittenti.map((e) => (
            <button
              key={e.id}
              type="button"
              role="radio"
              aria-checked={emId === e.id}
              onClick={() => setEmId(e.id)}
              className={cn(
                "flex items-center justify-between gap-3 rounded-[18px] border px-5 py-[18px] text-left",
                emId === e.id
                  ? "border-ink bg-ink text-paper"
                  : "border-white/75 bg-white/55 text-ink",
              )}
            >
              <span className="flex flex-col gap-1">
                <span className="font-display text-[17px] font-semibold">{e.nome}</span>
                <span className="text-[13px] opacity-80">es. {e.sezionale}</span>
              </span>
              <span className="flex-none rounded-full border border-current px-2.5 py-1.5 text-xs leading-none font-medium whitespace-nowrap opacity-85">
                {e.regole.ivaAttiva ? `IVA ${formatAliquota(e.regole.aliquotaIvaBp)}` : "Senza IVA"}
              </span>
            </button>
          ))}
        </div>
      </section>

      <Card className="flex flex-col gap-[18px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-[22px] font-medium tracking-[-0.015em]">Intestatario</h2>
          <Segmenti
            etichetta="Tipo di cliente"
            opzioni={MODI}
            valore={modo}
            onChange={setModo}
            className="flex-[0_1_520px]"
          />
        </div>
        {modo === "twenty" && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3.5">
            <label className="flex flex-col gap-2">
              <Etichetta>Azienda in Twenty</Etichetta>
              <Select name="clienteRefId" defaultValue="" required>
                <option value="" disabled>
                  Scegli…
                </option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </label>
            <p className="self-end text-[13px] leading-relaxed text-ink-2">
              P.IVA, SDI e indirizzo arrivano da Twenty.
            </p>
          </div>
        )}
        {modo === "occasionale" && (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
            <label className="flex flex-col gap-2">
              <Etichetta>Ragione sociale</Etichetta>
              <Input name="nome" required />
            </label>
            <label className="flex flex-col gap-2">
              <Etichetta>P.IVA</Etichetta>
              <Input name="partitaIva" inputMode="numeric" placeholder="11 cifre" />
            </label>
            <label className="flex flex-col gap-2">
              <Etichetta>Codice SDI o PEC</Etichetta>
              <Input name="sdiPec" placeholder="7 caratteri oppure PEC" />
            </label>
            <label className="col-span-full flex flex-col gap-2">
              <Etichetta>Indirizzo</Etichetta>
              <Input name="indirizzo" placeholder="Via, CAP, Città" />
            </label>
          </div>
        )}
        {modo === "privato" && (
          <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3.5">
              <label className="flex flex-col gap-2">
                <Etichetta>Nome e cognome</Etichetta>
                <Input name="nome" required />
              </label>
              <label className="flex flex-col gap-2">
                <Etichetta>Codice fiscale</Etichetta>
                <Input name="codiceFiscale" placeholder="16 caratteri" />
              </label>
              <label className="flex flex-col gap-2">
                <Etichetta>Indirizzo</Etichetta>
                <Input name="indirizzo" placeholder="Via, CAP, Città" />
              </label>
            </div>
            <p className="text-[13px] text-ink-2">
              Privato: codice destinatario 0000000, la fattura resta nel cassetto fiscale.
            </p>
          </>
        )}
      </Card>

      <section className="flex flex-wrap items-start gap-5">
        <Card className="flex min-w-0 flex-[999_1_560px] flex-col gap-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[22px] font-medium tracking-[-0.015em]">Righe</h2>
            {voci.length > 0 && (
              <label className="flex items-center gap-2.5 text-[13px] text-ink-2">
                Dal listino
                <select
                  aria-label="Aggiungi voce dal listino"
                  value=""
                  onChange={(e) => {
                    const v = voci.find((x) => x.id === e.target.value);
                    if (v) aggiungi(v.nome, formatEuro(v.prezzoCent).replace(/[^\d,]/g, ""));
                  }}
                  className="min-h-10 rounded-full border border-ink/16 bg-white/60 px-3.5 text-[13px] font-medium"
                >
                  <option value="">Scegli…</option>
                  {voci.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} · {formatEuro(v.prezzoCent)}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[560px] flex-col gap-3.5">
              <div className="grid grid-cols-[minmax(0,1fr)_76px_120px_36px] gap-2.5 border-b border-ink/14 pb-2 text-[11px] leading-tight font-medium tracking-[0.12em] text-muted uppercase">
                <span>Descrizione</span>
                <span>Qtà</span>
                <span>Prezzo netto</span>
                <span />
              </div>
              {righe.map((r) => (
                <div
                  key={r.k}
                  className="grid grid-cols-[minmax(0,1fr)_76px_120px_36px] items-center gap-2.5"
                >
                  <Input
                    aria-label="Descrizione"
                    value={r.d}
                    onChange={(e) => aggiorna(r.k, "d", e.target.value)}
                  />
                  <Input
                    aria-label="Quantità"
                    inputMode="numeric"
                    className="text-right tabular-nums"
                    value={r.q}
                    onChange={(e) => aggiorna(r.k, "q", e.target.value)}
                  />
                  <Input
                    aria-label="Prezzo netto"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    value={r.p}
                    onChange={(e) => aggiorna(r.k, "p", e.target.value)}
                  />
                  <button
                    type="button"
                    aria-label="Rimuovi riga"
                    disabled={righe.length === 1}
                    onClick={() => setRighe((rs) => rs.filter((x) => x.k !== r.k))}
                    className="grid size-9 place-items-center rounded-full text-base hover:bg-ink hover:text-paper disabled:opacity-30"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pt-1.5">
            <Button type="button" variant="glass" size="sm" onClick={() => aggiungi()}>
              Aggiungi riga <span aria-hidden>+</span>
            </Button>
          </div>
          <label className="mt-1.5 flex flex-col gap-2">
            <Etichetta>Note in fattura</Etichetta>
            <Input name="note" placeholder="Es. intervento del 22/10, rif. vostro ordine…" />
          </label>
        </Card>

        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <InkPanel className="flex flex-col gap-0.5">
            <span className="mb-2 text-[11px] leading-tight font-medium tracking-[0.14em] text-paper/70 uppercase">
              Totali
            </span>
            <Riga t="Imponibile" v={formatEuro(totali?.imponibileCent ?? 0)} />
            {em?.regole.ivaAttiva && (
              <Riga
                t={`IVA ${formatAliquota(em.regole.aliquotaIvaBp)}`}
                v={formatEuro(totali?.ivaCent ?? 0)}
              />
            )}
            {!!totali?.bolloCent && <Riga t="Marca da bollo" v={formatEuro(totali.bolloCent)} />}
            {!!totali?.ritenutaCent && (
              <Riga t="Ritenuta" v={`− ${formatEuro(totali.ritenutaCent)}`} />
            )}
            <div className="mt-2 flex items-end justify-between gap-4 border-t border-paper/16 pt-4">
              <span className="text-sm text-paper/80">Totale documento</span>
              <b className="money text-4xl leading-none font-semibold tracking-[-0.03em]">
                {formatEuro(totali?.totaleCent ?? 0)}
              </b>
            </div>
          </InkPanel>

          <Card className="flex flex-col gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="font-semibold">Già incassata</span>
                <span className="text-[13px] text-ink-2">Registra subito anche l&apos;incasso</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={incassata}
                aria-label="Già incassata"
                onClick={() => setIncassata((v) => !v)}
                className={cn(
                  "relative h-7 w-[46px] flex-none rounded-full transition-colors",
                  incassata ? "bg-ink" : "bg-grey-2",
                )}
              >
                <span
                  className={cn(
                    "absolute top-[3px] size-[22px] rounded-full bg-paper shadow transition-[left]",
                    incassata ? "left-[21px]" : "left-[3px]",
                  )}
                />
              </button>
            </div>
            {incassata ? (
              <>
                <Segmenti
                  etichetta="Metodo"
                  opzioni={METODI.map((m) => ({ id: m, label: m[0]?.toUpperCase() + m.slice(1) }))}
                  valore={metodo}
                  onChange={setMetodo}
                />
                <label className="flex flex-col gap-2">
                  <Etichetta>Conto</Etichetta>
                  <Select name="contoId" required defaultValue={contiEm[0]?.id}>
                    {contiEm.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                </label>
              </>
            ) : (
              <>
                <label className="flex flex-col gap-2">
                  <Etichetta>Scadenza pagamento</Etichetta>
                  <Select name="giorniScadenza" defaultValue="30">
                    {SCADENZE.map((s) => (
                      <option key={s.giorni} value={s.giorni}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <span className="text-[13px] text-ink-2">
                  Finisce nello scadenzario, con promemoria e solleciti da confermare.
                </span>
              </>
            )}
          </Card>
        </div>
      </section>
    </form>
  );
}

function Riga({ t, v }: { t: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm text-paper/82">
      <span>{t}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

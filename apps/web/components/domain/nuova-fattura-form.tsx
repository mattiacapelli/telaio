"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  parseEuro,
  type RegoleFiscali,
} from "@telaio/core";
import { Check, Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { salvaFatturaLiberaAction } from "@/app/(app)/fatture/actions";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { Switch } from "@/components/ui/switch";
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
interface RigaForm {
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
const METODI = ["bonifico", "contante", "carta"] as const;
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
}: {
  etichetta: string;
  opzioni: { id: T; label: string }[];
  valore: T;
  onChange: (v: T) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={etichetta}
      className="inline-flex gap-0.5 rounded-md border border-line bg-subtle p-0.5"
    >
      {opzioni.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={valore === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            "h-7 cursor-pointer rounded-sm px-3 text-sm font-medium transition-colors duration-150",
            valore === o.id ? "bg-surface text-fg shadow-xs" : "text-fg-2 hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const Riga = ({ t, v, forte }: { t: string; v: string; forte?: boolean }) => (
  <div
    className={cn(
      "flex justify-between gap-4 py-1.5 text-sm",
      forte ? "font-semibold text-fg" : "text-fg-2",
    )}
  >
    <span>{t}</span>
    <span className="tabular-nums">{v}</span>
  </div>
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
  const [righe, setRighe] = useState<RigaForm[]>([{ k: 1, d: "", q: "1", p: "" }]);
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

      <PageHeader
        titolo="Nuova fattura"
        descrizione="Nessun preventivo, nessuna rata: scrivi le righe a mano o pescale dal listino. Il numero arriva solo all'emissione."
        stato={<Badge dot>Bozza</Badge>}
        azioni={
          <>
            <Button asChild variant="ghost">
              <Link href="/fatture">Annulla</Link>
            </Button>
            <Button
              type="submit"
              name="azione"
              value="bozza"
              variant="secondary"
              disabled={inCorso}
            >
              Salva bozza
            </Button>
            <Button type="submit" name="azione" value="emetti" disabled={inCorso}>
              Emetti fattura
            </Button>
          </>
        }
      />

      {state.message && !state.ok && (
        <p
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {state.message}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium">Emittente</h2>
        <div
          role="radiogroup"
          aria-label="Ragione sociale emittente"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
        >
          {emittenti.map((e) => {
            const on = emId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setEmId(e.id)}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors duration-150",
                  on
                    ? "border-brand bg-brand-soft ring-1 ring-brand"
                    : "border-line bg-surface hover:bg-subtle",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{e.nome}</span>
                  {on && <Check className="size-4 text-brand" aria-hidden />}
                </span>
                <span className="text-xs text-fg-2">es. {e.sezionale}</span>
                <span>
                  <Badge variant={e.regole.ivaAttiva ? "neutral" : "warn"}>
                    {e.regole.ivaAttiva
                      ? `IVA ${formatAliquota(e.regole.aliquotaIvaBp)}`
                      : "Senza IVA"}
                  </Badge>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Intestatario</h2>
          <Segmenti etichetta="Tipo di cliente" opzioni={MODI} valore={modo} onChange={setModo} />
        </div>
        {modo === "twenty" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Azienda in Twenty" hint="P.IVA, SDI e indirizzo arrivano da Twenty.">
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
            </Field>
          </div>
        )}
        {modo === "occasionale" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ragione sociale">
              <Input name="nome" required />
            </Field>
            <Field label="P.IVA">
              <Input name="partitaIva" inputMode="numeric" placeholder="11 cifre" />
            </Field>
            <Field label="Codice SDI o PEC">
              <Input name="sdiPec" placeholder="7 caratteri oppure PEC" />
            </Field>
            <Field label="Indirizzo">
              <Input name="indirizzo" placeholder="Via, CAP, Città" />
            </Field>
          </div>
        )}
        {modo === "privato" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nome e cognome">
                <Input name="nome" required />
              </Field>
              <Field label="Codice fiscale">
                <Input name="codiceFiscale" placeholder="16 caratteri" />
              </Field>
              <Field label="Indirizzo">
                <Input name="indirizzo" placeholder="Via, CAP, Città" />
              </Field>
            </div>
            <p className="mt-3 text-sm text-fg-2">
              Privato: codice destinatario 0000000, la fattura resta nel cassetto fiscale.
            </p>
          </>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Card className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold">Righe</h2>
            {voci.length > 0 && (
              <label className="flex items-center gap-2 text-sm text-fg-2">
                Dal listino
                <Select
                  aria-label="Aggiungi voce dal listino"
                  value=""
                  onChange={(e) => {
                    const v = voci.find((x) => x.id === e.target.value);
                    if (v) aggiungi(v.nome, formatEuro(v.prezzoCent).replace(/[^\d,]/g, ""));
                  }}
                  className="h-7 w-auto"
                >
                  <option value="">Scegli…</option>
                  {voci.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} · {formatEuro(v.prezzoCent)}
                    </option>
                  ))}
                </Select>
              </label>
            )}
          </div>
          <div className="overflow-x-auto">
            <div className="flex min-w-[520px] flex-col gap-2">
              <div className="grid grid-cols-[minmax(0,1fr)_72px_112px_32px] gap-2 border-b border-line pb-1.5 text-xs font-medium text-fg-2">
                <span>Descrizione</span>
                <span>Qtà</span>
                <span>Prezzo netto</span>
                <span />
              </div>
              {righe.map((r) => (
                <div
                  key={r.k}
                  className="grid grid-cols-[minmax(0,1fr)_72px_112px_32px] items-center gap-2"
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
                  <IconButton
                    label="Rimuovi riga"
                    disabled={righe.length === 1}
                    onClick={() => setRighe((rs) => rs.filter((x) => x.k !== r.k))}
                    type="button"
                  >
                    <X />
                  </IconButton>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Button type="button" variant="secondary" size="sm" onClick={() => aggiungi()}>
              <Plus /> Aggiungi riga
            </Button>
          </div>
          <Field label="Note in fattura">
            <Input name="note" placeholder="Es. intervento del 22/10, rif. vostro ordine…" />
          </Field>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Totali" />
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
            <div className="my-1 border-t border-line" />
            <div className="flex items-baseline justify-between gap-4 py-1">
              <span className="text-sm font-medium">Totale documento</span>
              <b className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatEuro(totali?.totaleCent ?? 0)}
              </b>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium">Già incassata</span>
                <span className="text-xs text-fg-2">Registra subito anche l&apos;incasso</span>
              </div>
              <Switch label="Già incassata" checked={incassata} onCheckedChange={setIncassata} />
            </div>
            {incassata ? (
              <>
                <Segmenti
                  etichetta="Metodo"
                  opzioni={METODI.map((m) => ({ id: m, label: m[0]?.toUpperCase() + m.slice(1) }))}
                  valore={metodo}
                  onChange={setMetodo}
                />
                <Field label="Conto">
                  <Select name="contoId" required defaultValue={contiEm[0]?.id}>
                    {contiEm.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nome}
                      </option>
                    ))}
                  </Select>
                </Field>
              </>
            ) : (
              <>
                <Field label="Scadenza pagamento">
                  <Select name="giorniScadenza" defaultValue="30">
                    {SCADENZE.map((s) => (
                      <option key={s.giorni} value={s.giorni}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <p className="text-xs text-fg-2">
                  Finisce nello scadenzario, con promemoria e solleciti da confermare.
                </p>
              </>
            )}
          </Card>
        </div>
      </div>
    </form>
  );
}

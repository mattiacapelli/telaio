"use client";

import {
  calcolaTotali,
  formatAliquota,
  formatEuro,
  moduliCompatibili,
  prezzoVisualizzato,
  totaliConfiguratore,
} from "@telaio/core";
import { Check, Copy, Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { creaPreventivoAction } from "@/app/(app)/configuratore/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, EmptyState } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { toast } from "@/components/ui/toast";
import type { ListinoCfg } from "@/lib/listini-cfg";
import { cn } from "@/lib/utils";

const SCONTI = [0, 5, 10, 15];
const VALIDITA = [15, 30, 60, 90];

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

/** Editor del preventivo da listino: emittente, cliente, voci, sconto e riepilogo. Salva una bozza. */
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
  const descModulo = (id: string) => listino?.moduli.find((x) => x.id === id)?.descrizione;
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

  const copiaRiepilogo = async () => {
    const testo = [
      `Offerta · ${listino?.ragioneSociale ?? ""}`,
      ...voci.map((v) => `- ${v.nome}`),
      `Una tantum netto: ${formatEuro(tot.unaTantumCent)}`,
      doc ? `Totale una tantum: ${formatEuro(doc.totaleCent)}` : "",
      canoneAnno ? `Canone annuo netto: ${formatEuro(canoneAnno)}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    await navigator.clipboard?.writeText(testo);
    toast("Riepilogo copiato");
  };

  if (listini.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          title="Nessun listino"
          action={
            <Button asChild>
              <Link href="/impostazioni/listini">Crea un listino</Link>
            </Button>
          }
        >
          Serve almeno un listino con una base per comporre un preventivo.
        </EmptyState>
      </Card>
    );
  }

  return (
    <form action={azione} className="contents">
      <input type="hidden" name="ragioneSocialeId" value={listino?.ragioneSocialeId ?? ""} />
      <input type="hidden" name="baseId" value={baseId} />
      <input type="hidden" name="scontoBp" value={sconto * 100} />
      <input type="hidden" name="validitaGiorni" value={validita} />
      {moduloIds.map((m) => (
        <input key={m} type="hidden" name="moduloIds" value={m} />
      ))}

      <PageHeader
        titolo="Nuovo preventivo"
        descrizione="L'emittente decide numerazione e IVA. Ogni prezzo è mostrato netto e, dove c'è IVA, anche ivato. Il numero arriva quando lo invii al cliente."
        stato={<Badge dot>Bozza</Badge>}
        azioni={
          <>
            <Button asChild variant="ghost">
              <Link href="/preventivi">Annulla</Link>
            </Button>
            <Button type="submit" disabled={!base || pending}>
              {pending ? "Creazione…" : "Salva bozza"}
            </Button>
          </>
        }
      />

      {stato.message && !stato.ok && (
        <p
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {stato.message}
        </p>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-fg">Emittente</h2>
        <div
          role="radiogroup"
          aria-label="Ragione sociale emittente"
          className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
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
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 text-left transition-colors duration-150",
                  on
                    ? "border-brand bg-brand-soft ring-1 ring-brand"
                    : "border-line bg-surface hover:bg-subtle",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{l.ragioneSociale}</span>
                  {on && <Check className="size-4 text-brand" aria-hidden />}
                </span>
                <span className="text-xs text-fg-2">Listino {l.nome}</span>
                <span>
                  <Badge variant={l.regole.ivaAttiva ? "neutral" : "warn"}>
                    {l.regole.ivaAttiva
                      ? `IVA ${formatAliquota(l.regole.aliquotaIvaBp)}`
                      : "Senza IVA"}
                  </Badge>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="grid gap-4 sm:grid-cols-2">
            <Field label="Cliente (da Twenty)" hint="Puoi assegnarlo anche dopo">
              <Select name="clienteTwentyId" defaultValue={clienteIniziale ?? ""}>
                <option value="">Da assegnare</option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Validità">
              <Select value={validita} onChange={(e) => setValidita(Number(e.target.value))}>
                {VALIDITA.map((g) => (
                  <option key={g} value={g}>
                    {g} giorni
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Oggetto" hint="Se vuoto usa il nome della base" className="sm:col-span-2">
              <Input name="oggetto" />
            </Field>
          </Card>

          <Card>
            <CardHeader
              title="Voci"
              description="Scegli una base: ti propongo solo i moduli compatibili."
            />
            <div role="radiogroup" aria-label="Base" className="grid gap-2 sm:grid-cols-2">
              {listino?.basi.length === 0 && (
                <p className="text-sm text-fg-2">Questo listino non ha ancora basi.</p>
              )}
              {listino?.basi.map((b) => {
                const on = b.id === baseId;
                return (
                  <button
                    key={b.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setBaseId(b.id);
                      setModuloIds((p) =>
                        p.filter((m) =>
                          listino.moduli.find((x) => x.id === m)?.baseIds.includes(b.id),
                        ),
                      );
                    }}
                    className={cn(
                      "flex cursor-pointer flex-col gap-0.5 rounded-lg border p-3 text-left transition-colors duration-150",
                      on
                        ? "border-brand bg-brand-soft ring-1 ring-brand"
                        : "border-line hover:bg-subtle",
                    )}
                  >
                    <span className="text-sm font-semibold">{b.nome}</span>
                    {b.descrizione && <span className="text-xs text-fg-2">{b.descrizione}</span>}
                    <span className="text-xs text-fg-2 tabular-nums">
                      {formatEuro(b.unaTantumCent)}
                      {b.canoneAnnuoCent > 0 && ` + ${formatEuro(b.canoneAnnuoCent)}/anno`}
                      {b.canoneMensileCent > 0 && ` + ${formatEuro(b.canoneMensileCent)}/mese`}
                    </span>
                  </button>
                );
              })}
            </div>

            {base && (
              <div className="mt-4 border-t border-line pt-3">
                <h3 className="mb-1 text-sm font-medium">Moduli compatibili</h3>
                {compatibili.length === 0 && (
                  <p className="text-sm text-fg-2">Nessun modulo è assegnato a questa base.</p>
                )}
                <ul className="divide-y divide-line">
                  {compatibili.map((m) => {
                    const on = moduloIds.includes(m.id);
                    const lordo =
                      regole && m.unaTantumCent > 0
                        ? prezzoVisualizzato(m.unaTantumCent, regole).lordoCent
                        : null;
                    return (
                      <li key={m.id} className="flex items-center gap-3 py-2.5">
                        <span className="flex min-w-0 flex-1 flex-col leading-tight">
                          <span className="text-sm font-medium">{m.nome}</span>
                          <span className="text-xs text-fg-3 tabular-nums">
                            {descModulo(m.id) ? `${descModulo(m.id)} · ` : ""}
                            {formatEuro(m.unaTantumCent)}
                            {lordo !== null && ` (${formatEuro(lordo)} ivato)`}
                            {m.canoneAnnuoCent > 0 && ` · ${formatEuro(m.canoneAnnuoCent)}/a`}
                            {m.canoneMensileCent > 0 && ` · ${formatEuro(m.canoneMensileCent)}/m`}
                          </span>
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant={on ? "primary" : "secondary"}
                          aria-pressed={on}
                          aria-label={on ? `Rimuovi ${m.nome}` : `Aggiungi ${m.nome}`}
                          onClick={() =>
                            setModuloIds((p) => (on ? p.filter((x) => x !== m.id) : [...p, m.id]))
                          }
                        >
                          {on ? <X /> : <Plus />}
                          {on ? "Rimuovi" : "Aggiungi"}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3">
              <span className="text-sm text-fg-2">Sconto una tantum</span>
              <div role="group" aria-label="Sconto" className="flex gap-1.5">
                {SCONTI.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    size="sm"
                    variant={sconto === s ? "primary" : "secondary"}
                    onClick={() => setSconto(s)}
                  >
                    {s === 0 ? "Nessuno" : `${s}%`}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </div>

        <Card className="h-fit lg:sticky lg:top-4" aria-live="polite">
          <CardHeader title="Riepilogo" description={iva} />
          {voci.length === 0 ? (
            <p className="text-sm text-fg-2">Scegli una base per iniziare.</p>
          ) : (
            <ul className="mb-2 divide-y divide-line border-y border-line text-sm">
              {voci.map((v) => (
                <li key={v.id} className="flex justify-between gap-3 py-1.5">
                  <span>{v.nome}</span>
                  <span className="text-fg-2 tabular-nums">
                    {formatEuro(v.unaTantumCent || v.canoneAnnuoCent || v.canoneMensileCent)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Riga t="Una tantum netto" v={formatEuro(tot.unaTantumCent)} />
          {sconto > 0 && <Riga t={`Sconto ${sconto}%`} v={`− ${formatEuro(scontoCent)}`} />}
          {regole?.ivaAttiva && doc && <Riga t={iva} v={formatEuro(doc.ivaCent)} />}
          {doc && doc.bolloCent > 0 && <Riga t="Marca da bollo" v={formatEuro(doc.bolloCent)} />}
          <div className="my-1 border-t border-line" />
          <Riga t="Totale una tantum" v={formatEuro(doc?.totaleCent ?? 0)} forte />
          {canoneAnno > 0 && (
            <>
              <Riga t="Canone annuo netto" v={formatEuro(canoneAnno)} />
              {canoneV?.lordoCent != null && (
                <Riga t="Canone annuo IVA inclusa" v={formatEuro(canoneV.lordoCent)} />
              )}
            </>
          )}
          <div className="mt-3 flex flex-col gap-1 border-t border-line pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-fg-2">Primo anno netto</span>
              <b className="font-semibold tabular-nums">{formatEuro(primoNetto)}</b>
            </div>
            {regole?.ivaAttiva && (
              <div className="flex justify-between text-sm">
                <span className="text-fg-2">Primo anno IVA inclusa</span>
                <b className="font-semibold tabular-nums">{formatEuro(primoLordo)}</b>
              </div>
            )}
          </div>
          {regole && !regole.ivaAttiva && regole.diciturSenzaIva && (
            <p className="mt-3 text-xs text-fg-2">{regole.diciturSenzaIva}</p>
          )}
          <Button
            type="button"
            variant="secondary"
            className="mt-4 w-full"
            disabled={!base}
            onClick={copiaRiepilogo}
          >
            <Copy /> Copia riepilogo
          </Button>
        </Card>
      </div>
    </form>
  );
}

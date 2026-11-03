"use client";

import {
  ETICHETTA_PERIODO,
  formatAliquota,
  formatEuro,
  importoDi,
  nomeServizio,
  type RegoleFiscali,
  type RigaDecisione,
  ricorrente,
  servizi,
  totaliAccettazione,
  valutaAccettazione,
} from "@telaio/core";
import { useActionState, useEffect, useState, useTransition } from "react";
import { accettaPreventivoAction } from "@/app/(app)/preventivi/[id]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { initialState } from "@/components/ui/form-modal";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

export interface RigaAccettazione extends RigaDecisione {
  descrizione: string;
}

const Riepilogo = ({ t, v, forte }: { t: string; v: string; forte?: boolean }) => (
  <div className={cn("flex justify-between gap-3 py-0.5 text-sm", forte && "font-semibold")}>
    <span className={forte ? "text-fg" : "text-fg-2"}>{t}</span>
    <span className="tabular-nums">{v}</span>
  </div>
);

/**
 * Registra l'accettazione di un preventivo inviato: le prestazioni una tantum si deselezionano se il
 * cliente non le accetta, gli abbonamenti si accettano o escludono e, per le alternative annuale/mensile,
 * si sceglie esplicitamente una periodicità (o nessuna). I totali mostrati usano le stesse funzioni del
 * server, che comunque riconvalida tutto.
 */
export function AccettaPreventivo({
  preventivoId,
  righe,
  regole,
  oggi,
}: {
  preventivoId: string;
  righe: RigaAccettazione[];
  regole: RegoleFiscali;
  /** data di oggi (AAAA-MM-GG): decorrenza iniziale degli abbonamenti */
  oggi: string;
}) {
  const [aperto, setAperto] = useState(false);
  const [stato, formAction, pendingAzione] = useActionState(accettaPreventivoAction, initialState);
  const [inTransizione, avvia] = useTransition();
  const pending = pendingAzione || inTransizione;

  const [indipendenti, setIndipendenti] = useState<Set<string>>(
    () => new Set(righe.filter((r) => !r.gruppoAlternativaId).map((r) => r.id)),
  );
  /** gruppo → riga scelta, "none" = servizio escluso, assente = non ancora scelto */
  const [scelte, setScelte] = useState<Record<string, string>>({});
  const [decorrenza, setDecorrenza] = useState(oggi);

  useEffect(() => {
    if (stato.ok) {
      setAperto(false);
      toast(stato.message ?? "Fatto");
    }
  }, [stato]);

  const elenco = servizi(righe);
  const gruppi = elenco.filter((s) => s.gruppo);
  const mancanti = gruppi.filter((g) => scelte[g.chiave] === undefined);
  const unaTantum = elenco.filter((s) => !s.gruppo && s.righe[0]?.tipo === "una_tantum");
  const abbonamentiIndipendenti = elenco.filter(
    (s) => !s.gruppo && s.righe[0] && ricorrente(s.righe[0].tipo),
  );

  const scelta = {
    righe: [...indipendenti],
    gruppi: Object.fromEntries(
      gruppi.map((g) => [
        g.chiave,
        scelte[g.chiave] && scelte[g.chiave] !== "none" ? (scelte[g.chiave] as string) : null,
      ]),
    ),
  };
  const valutazione = valutaAccettazione(righe, scelta);
  const t = totaliAccettazione(righe, valutazione.decisioni, regole);
  const accettate = righe.filter((r) => valutazione.decisioni.get(r.id));
  const canoniAccettati = accettate.filter((r) => ricorrente(r.tipo));
  const nessuna = mancanti.length === 0 && valutazione.esito === "rifiutato";
  const iva = regole.ivaAttiva ? `IVA ${formatAliquota(regole.aliquotaIvaBp)}` : "Senza IVA";
  const haCanoni = righe.some((r) => ricorrente(r.tipo));

  const esitoEtichetta =
    mancanti.length > 0
      ? { testo: "Scegli le alternative", variante: "warn" as const }
      : valutazione.esito === "accettato"
        ? { testo: "Accettazione totale", variante: "ok" as const }
        : valutazione.esito === "accettato_parzialmente"
          ? { testo: "Accettazione parziale", variante: "warn" as const }
          : { testo: "Rifiuto", variante: "bad" as const };

  function invia(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const dati = new FormData(ev.currentTarget);
    const mittente = (ev.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    if (mittente?.value === "rifiuta") dati.set("intent", "rifiuta");
    avvia(() => formAction(dati));
  }

  const importo = (r: RigaDecisione) => formatEuro(importoDi(r));
  const etichettaRiga = (r: RigaDecisione) =>
    r.tipo === "una_tantum"
      ? `${r.quantita > 1 ? `${r.quantita} × ` : ""}${importo(r)}`
      : `${importo(r)} / ${ETICHETTA_PERIODO[r.tipo as "canone_annuo" | "canone_mensile"]}`;

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button>Registra accettazione</Button>
      </DialogTrigger>
      <DialogContent
        title="Registra l'accettazione"
        description="Seleziona cosa ha accettato il cliente. Le righe escluse restano nel preventivo, barrate."
        size="lg"
      >
        <form onSubmit={invia} className="flex flex-col gap-5">
          <input type="hidden" name="id" value={preventivoId} />

          {unaTantum.length > 0 && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">Prestazioni una tantum</h3>
              <ul className="divide-y divide-line rounded-md border border-line">
                {unaTantum.map(({ righe: [r] }) => {
                  const riga = r as RigaAccettazione;
                  const on = indipendenti.has(riga.id);
                  return (
                    <li key={riga.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                        <Checkbox
                          name="righe"
                          value={riga.id}
                          checked={on}
                          onChange={(e) =>
                            setIndipendenti((p) => {
                              const n = new Set(p);
                              if (e.target.checked) n.add(riga.id);
                              else n.delete(riga.id);
                              return n;
                            })
                          }
                        />
                        <span className={cn("min-w-0 flex-1", !on && "text-fg-3 line-through")}>
                          {riga.descrizione}
                        </span>
                        <span className={cn("tabular-nums", !on && "text-fg-3 line-through")}>
                          {importo(riga)}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {haCanoni && (
            <section className="flex flex-col gap-1.5">
              <h3 className="text-sm font-semibold">Abbonamenti</h3>
              <ul className="divide-y divide-line rounded-md border border-line">
                {abbonamentiIndipendenti.map(({ righe: [r] }) => {
                  const riga = r as RigaAccettazione;
                  const on = indipendenti.has(riga.id);
                  return (
                    <li key={riga.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-sm">
                        <Checkbox
                          name="righe"
                          value={riga.id}
                          checked={on}
                          onChange={(e) =>
                            setIndipendenti((p) => {
                              const n = new Set(p);
                              if (e.target.checked) n.add(riga.id);
                              else n.delete(riga.id);
                              return n;
                            })
                          }
                        />
                        <span className={cn("min-w-0 flex-1", !on && "text-fg-3 line-through")}>
                          {nomeServizio(riga.descrizione)}
                        </span>
                        <span className={cn("tabular-nums", !on && "text-fg-3 line-through")}>
                          {etichettaRiga(riga)}
                        </span>
                      </label>
                    </li>
                  );
                })}
                {gruppi.map((g) => {
                  const nome = nomeServizio((g.righe[0] as RigaAccettazione).descrizione);
                  const scelto = scelte[g.chiave];
                  return (
                    <li key={g.chiave} className="px-3 py-2.5">
                      <fieldset className="flex flex-col gap-1.5 text-sm">
                        <legend className="mb-1 flex items-center gap-2 font-medium">
                          {nome}
                          {scelto === undefined && <Badge variant="warn">Scegli</Badge>}
                        </legend>
                        {g.righe.map((r) => (
                          <label key={r.id} className="flex cursor-pointer items-center gap-2.5">
                            <input
                              type="radio"
                              name={`gruppo:${g.chiave}`}
                              value={r.id}
                              checked={scelto === r.id}
                              onChange={() => setScelte((p) => ({ ...p, [g.chiave]: r.id }))}
                              className="size-4 accent-[var(--brand)]"
                            />
                            <span className="tabular-nums">
                              {r.tipo === "canone_annuo" ? "Canone annuale" : "Canone mensile"} ·{" "}
                              {etichettaRiga(r)}
                            </span>
                          </label>
                        ))}
                        <label className="flex cursor-pointer items-center gap-2.5 text-fg-2">
                          <input
                            type="radio"
                            name={`gruppo:${g.chiave}`}
                            value="none"
                            checked={scelto === "none"}
                            onChange={() => setScelte((p) => ({ ...p, [g.chiave]: "none" }))}
                            className="size-4 accent-[var(--brand)]"
                          />
                          Nessuna delle due: il servizio non è stato acquistato
                        </label>
                      </fieldset>
                    </li>
                  );
                })}
              </ul>
              <Field
                label="Data decorrenza abbonamenti"
                hint="Prima scadenza degli abbonamenti accettati. Non può essere nel passato."
              >
                <Input
                  type="date"
                  name="decorrenza"
                  min={oggi}
                  value={decorrenza}
                  onChange={(e) => setDecorrenza(e.target.value || oggi)}
                  required
                />
              </Field>
            </section>
          )}

          <section className="rounded-md border border-line bg-subtle p-3" aria-live="polite">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Riepilogo</h3>
              <Badge variant={esitoEtichetta.variante} dot>
                {esitoEtichetta.testo}
              </Badge>
            </div>
            <Riepilogo
              t="Una tantum originale (imponibile)"
              v={formatEuro(t.originali.imponibileCent)}
            />
            <Riepilogo
              t="Una tantum accettato (imponibile)"
              v={formatEuro(t.accettati.imponibileCent)}
            />
            {t.escluseCent > 0 && (
              <Riepilogo t="Prestazioni escluse" v={`− ${formatEuro(t.escluseCent)}`} />
            )}
            {regole.ivaAttiva && <Riepilogo t={iva} v={formatEuro(t.accettati.ivaCent)} />}
            {t.accettati.bolloCent > 0 && (
              <Riepilogo t="Marca da bollo" v={formatEuro(t.accettati.bolloCent)} />
            )}
            <Riepilogo
              t="Totale una tantum accettato"
              v={formatEuro(t.accettati.totaleCent)}
              forte
            />
            {haCanoni && (
              <div className="mt-2 border-t border-line pt-2">
                <p className="mb-1 text-xs font-medium text-fg-2">
                  Abbonamenti selezionati (non sommati al totale)
                </p>
                {canoniAccettati.length === 0 ? (
                  <p className="text-sm text-fg-3">Nessuno</p>
                ) : (
                  canoniAccettati.map((r) => (
                    <Riepilogo key={r.id} t={nomeServizio(r.descrizione)} v={etichettaRiga(r)} />
                  ))
                )}
              </div>
            )}
          </section>

          {stato.message && !stato.ok && (
            <p
              role="alert"
              className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
            >
              {stato.message}
            </p>
          )}
          {nessuna && (
            <p className="text-sm text-fg-2">
              Il cliente non ha accettato nulla: puoi chiudere il preventivo come rifiutato.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Annulla
              </Button>
            </DialogClose>
            {nessuna ? (
              <Button type="submit" value="rifiuta" variant="danger" disabled={pending}>
                {pending ? "Salvataggio…" : "Rifiuta il preventivo"}
              </Button>
            ) : (
              <Button type="submit" disabled={pending || mancanti.length > 0}>
                {pending
                  ? "Salvataggio…"
                  : valutazione.esito === "accettato"
                    ? "Conferma accettazione totale"
                    : "Conferma accettazione parziale"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

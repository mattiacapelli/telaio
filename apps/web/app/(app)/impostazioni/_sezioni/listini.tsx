import { formatEuro } from "@telaio/core";
import type { listini, listinoBasi, listinoModuli, moduloBasi } from "@telaio/db";
import { Check } from "lucide-react";
import { Prezzo } from "@/components/domain/prezzo";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { regoleDa } from "@/lib/regole";
import { archiviaVoce, salvaBase, salvaListino, salvaModulo, toggleAssegnazione } from "../actions";
import type { RagioneSocialeRow } from "./tipi";

type Listino = typeof listini.$inferSelect;
type Base = typeof listinoBasi.$inferSelect;
type Modulo = typeof listinoModuli.$inferSelect;
type Assegnazione = typeof moduloBasi.$inferSelect;

const euro = (c: number) =>
  c
    ? formatEuro(c)
        .replace(/[^\d,.-]/g, "")
        .trim()
    : "";

function CampiVoce({
  listinoId,
  voce,
  basi,
  modulo,
}: {
  listinoId: string;
  voce?: Base | Modulo;
  basi?: Base[];
  modulo?: Assegnazione[];
}) {
  return (
    <>
      <input type="hidden" name="listinoId" value={listinoId} />
      {voce && <input type="hidden" name="id" value={voce.id} />}
      <Field label="Nome" name="nome">
        <Input name="nome" defaultValue={voce?.nome} required />
      </Field>
      <Field label="Descrizione">
        <Textarea name="descrizione" defaultValue={voce?.descrizione ?? ""} className="min-h-16" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Una tantum (€ netti)">
          <Input
            name="unaTantumCent"
            inputMode="decimal"
            defaultValue={euro(voce?.unaTantumCent ?? 0)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Canone annuo (€ netti)">
          <Input
            name="canoneAnnuoCent"
            inputMode="decimal"
            defaultValue={euro(voce?.canoneAnnuoCent ?? 0)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Canone mensile (€ netti)">
          <Input
            name="canoneMensileCent"
            inputMode="decimal"
            defaultValue={euro(voce?.canoneMensileCent ?? 0)}
            placeholder="0,00"
          />
        </Field>
      </div>
      {basi && (
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-fg">Basi compatibili</legend>
          {basi.length === 0 && <p className="text-sm text-fg-2">Crea prima almeno una base.</p>}
          {basi.map((b) => (
            <label
              key={b.id}
              className="flex min-h-11 items-center gap-3 rounded-lg border border-line bg-surface px-4"
            >
              <input
                type="checkbox"
                name="baseIds[]"
                value={b.id}
                defaultChecked={modulo?.some((a) => a.baseId === b.id)}
                className="size-4 accent-[var(--brand)]"
              />
              <span className="text-sm">{b.nome}</span>
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}

export function SezioneListini({
  elenco,
  ragioni,
  basi,
  moduli,
  assegnazioni,
}: {
  elenco: Listino[];
  ragioni: RagioneSocialeRow[];
  basi: Base[];
  moduli: Modulo[];
  assegnazioni: Assegnazione[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
        <FormModal
          trigger="Nuovo listino"
          title="Nuovo listino"
          description="Ogni listino appartiene a una ragione sociale."
          action={salvaListino}
        >
          <>
            <Field label="Ragione sociale" name="ragioneSocialeId">
              <Select name="ragioneSocialeId" required defaultValue="">
                <option value="" disabled>
                  Scegli…
                </option>
                {ragioni.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Nome" name="nome">
              <Input name="nome" required />
            </Field>
            <Field label="Descrizione">
              <Textarea name="descrizione" className="min-h-16" />
            </Field>
          </>
        </FormModal>
      </div>

      {elenco.length === 0 && (
        <EmptyState title="Nessun listino">
          Crea un listino per poter configurare i preventivi.
        </EmptyState>
      )}

      {elenco.map((l) => {
        const rs = ragioni.find((r) => r.id === l.ragioneSocialeId);
        const regole = rs
          ? regoleDa(rs)
          : { ivaAttiva: false, aliquotaIvaBp: 0, bolloAutomatico: false, splitPayment: false };
        const b = basi.filter((x) => x.listinoId === l.id);
        const m = moduli.filter((x) => x.listinoId === l.id);
        return (
          <Card key={l.id} className="flex flex-col gap-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-fg-3">{rs?.nome}</p>
                <h2 className="font-display text-2xl font-semibold">{l.nome}</h2>
                {l.descrizione && <p className="mt-1 text-sm text-fg-2">{l.descrizione}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                <FormModal
                  trigger="Nuova base"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  title="Nuova base"
                  description="Il prodotto di partenza del preventivo."
                  action={salvaBase}
                >
                  <CampiVoce listinoId={l.id} />
                </FormModal>
                <FormModal
                  trigger="Nuovo modulo"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  title="Nuovo modulo"
                  description="Assegnabile a una o più basi."
                  action={salvaModulo}
                >
                  <CampiVoce listinoId={l.id} basi={b} />
                </FormModal>
              </div>
            </div>

            <TabellaVoci
              titolo="Basi"
              tipo="base"
              voci={b}
              regole={regole}
              modifica={(v) => (
                <FormModal
                  trigger="Modifica"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  title={`Modifica ${v.nome}`}
                  action={salvaBase}
                >
                  <CampiVoce listinoId={l.id} voce={v} />
                </FormModal>
              )}
            />

            <TabellaVoci
              titolo="Moduli aggiuntivi"
              tipo="modulo"
              voci={m}
              regole={regole}
              modifica={(v) => (
                <FormModal
                  trigger="Modifica"
                  triggerVariant="ghost"
                  triggerSize="sm"
                  title={`Modifica ${v.nome}`}
                  action={salvaModulo}
                >
                  <CampiVoce
                    listinoId={l.id}
                    voce={v}
                    basi={b}
                    modulo={assegnazioni.filter((a) => a.moduloId === v.id)}
                  />
                </FormModal>
              )}
            />

            {b.length > 0 && m.length > 0 && (
              <div>
                <h3 className="font-display text-lg font-semibold">Compatibilità modulo ↔ base</h3>
                <p className="mb-3 text-sm text-fg-2">
                  Il configuratore propone solo i moduli assegnati alla base scelta.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="text-left text-xs text-fg-2">
                        <th className="px-3 py-2 font-medium">Modulo</th>
                        {b.map((x) => (
                          <th key={x.id} className="px-3 py-2 text-center font-medium">
                            {x.nome}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {m.map((mod) => (
                        <tr key={mod.id} className="border-t border-line">
                          <td className="px-3 py-1 font-medium">{mod.nome}</td>
                          {b.map((base) => {
                            const attiva = assegnazioni.some(
                              (a) => a.moduloId === mod.id && a.baseId === base.id,
                            );
                            return (
                              <td key={base.id} className="px-3 py-1 text-center">
                                <form action={toggleAssegnazione}>
                                  <input type="hidden" name="moduloId" value={mod.id} />
                                  <input type="hidden" name="baseId" value={base.id} />
                                  <button
                                    type="submit"
                                    aria-pressed={attiva}
                                    aria-label={`${mod.nome} su ${base.nome}: ${attiva ? "assegnato" : "non assegnato"}`}
                                    className={`inline-grid size-11 place-items-center rounded-full border transition-colors ${attiva ? "border-fg bg-fg text-on-fg" : "border-line bg-subtle text-transparent hover:border-fg"}`}
                                  >
                                    <Check className="size-4" aria-hidden />
                                  </button>
                                </form>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function TabellaVoci<V extends Base | Modulo>({
  titolo,
  tipo,
  voci,
  regole,
  modifica,
}: {
  titolo: string;
  tipo: "base" | "modulo";
  voci: V[];
  regole: ReturnType<typeof regoleDa>;
  modifica: (v: V) => React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-display text-lg font-semibold">{titolo}</h3>
      {voci.length === 0 ? (
        <p className="mt-1 text-sm text-fg-2">Nessuna voce.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-xs text-fg-2">
                <th className="px-3 py-2 font-medium">Voce</th>
                <th className="px-3 py-2 font-medium">Una tantum</th>
                <th className="px-3 py-2 font-medium">Canone annuo</th>
                <th className="px-3 py-2 font-medium">Canone mensile</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {voci.map((v) => (
                <tr key={v.id} className="border-t border-line align-middle">
                  <td className="px-3 py-3 font-medium">{v.nome}</td>
                  <td className="px-3 py-3">
                    <Prezzo nettoCent={v.unaTantumCent} regole={regole} />
                  </td>
                  <td className="px-3 py-3">
                    <Prezzo nettoCent={v.canoneAnnuoCent} regole={regole} suffisso="/anno" />
                  </td>
                  <td className="px-3 py-3">
                    <Prezzo nettoCent={v.canoneMensileCent} regole={regole} suffisso="/mese" />
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      {modifica(v)}
                      <form action={archiviaVoce}>
                        <input type="hidden" name="id" value={v.id} />
                        <input type="hidden" name="tipo" value={tipo} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          aria-label={`Archivia ${v.nome}`}
                        >
                          Archivia
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

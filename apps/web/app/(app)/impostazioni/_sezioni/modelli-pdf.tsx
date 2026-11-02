import { COLORE_PREDEFINITO, MODELLO_PDF_PREDEFINITO, type ModelloPdf } from "@telaio/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { FormSwitch } from "@/components/ui/form-switch";
import { salvaModelloPdfAzione } from "../actions";
import type { RagioneSocialeRow } from "./tipi";

/** Modelli dei PDF di preventivi e fatture: aspetto e testi fissi, per ragione sociale. */
export function SezioneModelliPdf({
  elenco,
  modelli,
  logoIniziale,
}: {
  elenco: RagioneSocialeRow[];
  modelli: Record<string, ModelloPdf>;
  /** logo della configurazione iniziale, usato dove non ce n'è uno proprio */
  logoIniziale: string | null;
}) {
  return (
    <>
      <p className="max-w-prose text-sm text-fg-2">
        Ogni preventivo e ogni fattura si scarica in PDF dalla sua pagina. Qui scegli colore, logo,
        note e piè di pagina per ciascuna ragione sociale; intestazione e dati fiscali arrivano
        dall&apos;anagrafica.
      </p>
      <div className="grid gap-4 xl:grid-cols-2">
        {elenco.map((rs) => {
          const m = modelli[rs.id] ?? MODELLO_PDF_PREDEFINITO;
          const logo = m.logo ?? logoIniziale;
          return (
            <Card key={rs.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  {logo ? (
                    <img
                      src={logo}
                      alt={`Logo di ${rs.nome}`}
                      className="size-11 shrink-0 rounded-md border border-line bg-white object-contain"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="grid size-11 shrink-0 place-items-center rounded-md text-sm font-semibold text-white"
                      style={{ background: m.colore }}
                    >
                      {rs.nome.slice(0, 1)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold">{rs.nome}</h2>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-fg-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          aria-hidden
                          className="size-3 rounded-full border border-line"
                          style={{ background: m.colore }}
                        />
                        <span className="font-mono">{m.colore}</span>
                      </span>
                      {!m.logo && logoIniziale && <Badge>Logo della configurazione iniziale</Badge>}
                      {!logo && <Badge>Senza logo</Badge>}
                      {m.mostraIban && rs.iban && <Badge variant="brand">IBAN in calce</Badge>}
                    </div>
                  </div>
                </div>
                <FormModal
                  trigger="Modifica"
                  triggerVariant="secondary"
                  triggerSize="sm"
                  title={`Modello PDF · ${rs.nome}`}
                  description="Le modifiche valgono per i prossimi PDF, anche dei documenti già emessi."
                  action={salvaModelloPdfAzione}
                >
                  <input type="hidden" name="id" value={rs.id} />
                  <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                    <Field label="Colore" name="colore">
                      <Input
                        name="colore"
                        type="color"
                        defaultValue={m.colore || COLORE_PREDEFINITO}
                        className="h-9 cursor-pointer p-1"
                      />
                    </Field>
                    <Field
                      label="Logo"
                      hint="PNG o JPEG fino a 200 KB. Lascia vuoto per non cambiarlo."
                      name="logo"
                    >
                      <Input
                        name="logo"
                        type="file"
                        accept="image/png,image/jpeg"
                        className="h-auto py-1.5"
                      />
                    </Field>
                  </div>
                  {m.logo && (
                    <label className="flex items-center gap-2 text-sm text-fg-2">
                      <Checkbox name="rimuoviLogo" /> Rimuovi il logo attuale
                    </label>
                  )}
                  <Field
                    label="Note sui preventivi"
                    hint="Condizioni, validità, modalità di pagamento. Fino a 1000 caratteri."
                    name="notePreventivo"
                  >
                    <Textarea
                      name="notePreventivo"
                      defaultValue={m.notePreventivo}
                      rows={3}
                      maxLength={1000}
                    />
                  </Field>
                  <Field
                    label="Note sulle fatture"
                    hint="Per esempio le condizioni di pagamento o un ringraziamento."
                    name="noteFattura"
                  >
                    <Textarea
                      name="noteFattura"
                      defaultValue={m.noteFattura}
                      rows={3}
                      maxLength={1000}
                    />
                  </Field>
                  <Field
                    label="Piè di pagina"
                    hint="Su ogni pagina, per esempio REA o capitale sociale. Fino a 300 caratteri."
                    name="piePagina"
                  >
                    <Textarea
                      name="piePagina"
                      defaultValue={m.piePagina}
                      rows={2}
                      maxLength={300}
                    />
                  </Field>
                  <FormSwitch
                    name="mostraIban"
                    label="Mostra l'IBAN"
                    description={
                      rs.iban
                        ? "In fondo al documento, per i bonifici."
                        : "Questa ragione sociale non ha un IBAN."
                    }
                    defaultChecked={m.mostraIban}
                  />
                </FormModal>
              </div>
              <dl className="grid gap-1 text-sm">
                <Riga etichetta="Note preventivi" valore={m.notePreventivo} />
                <Riga etichetta="Note fatture" valore={m.noteFattura} />
                <Riga etichetta="Piè di pagina" valore={m.piePagina} />
              </dl>
              <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/api/pdf/anteprima?rs=${rs.id}&tipo=preventivo`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Anteprima preventivo
                  </a>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <a
                    href={`/api/pdf/anteprima?rs=${rs.id}&tipo=fattura`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Anteprima fattura
                  </a>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}

function Riga({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="shrink-0 text-fg-2">{etichetta}</dt>
      <dd className="truncate text-right text-fg">
        {valore ? valore.replace(/\s+/g, " ") : <span className="text-fg-3">—</span>}
      </dd>
    </div>
  );
}

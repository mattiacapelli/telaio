import { creaFatturaLiberaAction } from "@/app/(app)/fatture/actions";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";

interface Opt {
  id: string;
  nome: string;
}

const RIGHE = [0, 1, 2, 3, 4];

/** Fattura non legata a un preventivo: cliente in anagrafica oppure occasionale/privato. */
export function FatturaLiberaModal({ clienti, emittenti }: { clienti: Opt[]; emittenti: Opt[] }) {
  return (
    <FormModal
      trigger="Nuova fattura"
      title="Nuova fattura libera"
      description="Resta in bozza finché non la emetti: solo allora prende il numero."
      submitLabel="Crea bozza"
      action={creaFatturaLiberaAction}
    >
      <Field label="Ragione sociale emittente" name="ragioneSocialeId">
        <Select name="ragioneSocialeId" required>
          {emittenti.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cliente in anagrafica" name="clienteRefId">
        <Select name="clienteRefId" defaultValue="">
          <option value="">— cliente occasionale o privato (compila sotto) —</option>
          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome o ragione sociale" name="nome">
          <Input name="nome" />
        </Field>
        <Field label="Partita IVA" name="partitaIva">
          <Input name="partitaIva" />
        </Field>
        <Field label="Codice fiscale" name="codiceFiscale">
          <Input name="codiceFiscale" />
        </Field>
        <Field label="Indirizzo" name="indirizzo">
          <Input name="indirizzo" />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium">Righe (le vuote vengono ignorate)</legend>
        {RIGHE.map((i) => (
          <div key={i} className="grid grid-cols-[1fr_64px_96px_72px] gap-2">
            <Input
              name={`descrizione${i}`}
              placeholder="Descrizione"
              aria-label={`Descrizione riga ${i + 1}`}
            />
            <Input
              name={`quantita${i}`}
              inputMode="numeric"
              placeholder="Qtà"
              aria-label={`Quantità riga ${i + 1}`}
            />
            <Input
              name={`prezzo${i}`}
              inputMode="decimal"
              placeholder="Prezzo €"
              aria-label={`Prezzo riga ${i + 1}`}
            />
            <Input
              name={`sconto${i}`}
              inputMode="decimal"
              placeholder="Sc. %"
              aria-label={`Sconto riga ${i + 1}`}
            />
          </div>
        ))}
      </fieldset>
      <Field label="Note" name="note">
        <Textarea name="note" rows={2} />
      </Field>
    </FormModal>
  );
}

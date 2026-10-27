import { creaAbbonamentoAction } from "@/app/(app)/abbonamenti/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";

interface Opt {
  id: string;
  nome: string;
}

export function AbbonamentoModal({ clienti, emittenti }: { clienti: Opt[]; emittenti: Opt[] }) {
  return (
    <FormModal
      trigger="Nuovo abbonamento"
      title="Nuovo abbonamento"
      description="Genera le rate sullo scadenzario per i prossimi 12 mesi."
      action={creaAbbonamentoAction}
    >
      <Field label="Cliente" name="clienteRefId">
        <Select name="clienteRefId" required>
          {clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ragione sociale emittente" name="ragioneSocialeId">
        <Select name="ragioneSocialeId" required>
          {emittenti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Descrizione" name="descrizione">
        <Input name="descrizione" required placeholder="Hosting e manutenzione" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Periodicità" name="periodicita">
          <Select name="periodicita" defaultValue="mensile">
            <option value="mensile">Mensile</option>
            <option value="trimestrale">Trimestrale</option>
            <option value="semestrale">Semestrale</option>
            <option value="annuale">Annuale</option>
          </Select>
        </Field>
        <Field label="Importo rata (€)" name="importo">
          <Input name="importo" inputMode="decimal" required />
        </Field>
        <Field label="Prima scadenza" name="inizio">
          <Input name="inizio" type="date" required defaultValue={oggi()} />
        </Field>
        <Field label="Fine (facoltativa)" name="fine">
          <Input name="fine" type="date" />
        </Field>
      </div>
    </FormModal>
  );
}

import { modificaDateFatturaAction } from "@/app/(app)/fatture/actions";
import { modificaDataIncassoAction } from "@/app/(app)/incassi/actions";
import type { ButtonProps } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";

/** Modale «Modifica data» di un incasso: la data può essere qualunque, passata o futura. */
export function ModificaDataIncasso({
  incasso,
  trigger,
  triggerVariant = "ghost",
  triggerSize = "sm",
  open,
  onOpenChange,
}: {
  incasso: { id: string; data: string };
  trigger?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <FormModal
      trigger={trigger}
      triggerVariant={triggerVariant}
      triggerSize={triggerSize}
      open={open}
      onOpenChange={onOpenChange}
      title="Modifica data incasso"
      description="Cambia il giorno dell'incasso e del movimento in prima nota. Importo e conto restano quelli registrati."
      action={modificaDataIncassoAction}
    >
      <input type="hidden" name="id" value={incasso.id} />
      <Field label="Data" name="data">
        <Input name="data" type="date" required defaultValue={incasso.data} />
      </Field>
    </FormModal>
  );
}

/** Modale «Modifica date» di una fattura emessa: emissione e scadenza. */
export function ModificaDateFattura({
  fattura,
}: {
  fattura: { id: string; anno: number; dataEmissione: string; scadenza: string };
}) {
  return (
    <FormModal
      trigger="Modifica date"
      triggerVariant="secondary"
      title="Modifica date della fattura"
      description={`L'emissione deve restare nel ${fattura.anno}, anno del numero. La scadenza si aggiorna anche nello scadenzario.`}
      action={modificaDateFatturaAction}
    >
      <input type="hidden" name="id" value={fattura.id} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data di emissione" name="dataEmissione">
          <Input
            name="dataEmissione"
            type="date"
            required
            min={`${fattura.anno}-01-01`}
            max={`${fattura.anno}-12-31`}
            defaultValue={fattura.dataEmissione}
          />
        </Field>
        <Field label="Scadenza" name="scadenza">
          <Input name="scadenza" type="date" required defaultValue={fattura.scadenza} />
        </Field>
      </div>
    </FormModal>
  );
}

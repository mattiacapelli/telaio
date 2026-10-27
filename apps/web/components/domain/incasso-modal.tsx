import { formatEuro } from "@telaio/core";
import { registraIncassoAction } from "@/app/(app)/incassi/actions";
import type { ButtonProps } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";

export interface ContoOpt {
  id: string;
  nome: string;
}

/** Modale «Registra incasso»: libero oppure legato a una rata o a una fattura. */
export function IncassoModal({
  conti,
  rataId,
  fatturaId,
  importoCent,
  descrizione,
  trigger = "Registra incasso",
  triggerVariant,
  triggerSize,
}: {
  conti: ContoOpt[];
  rataId?: string;
  fatturaId?: string;
  importoCent?: number;
  descrizione?: string;
  trigger?: string;
  triggerVariant?: ButtonProps["variant"];
  triggerSize?: ButtonProps["size"];
}) {
  return (
    <FormModal
      trigger={trigger}
      triggerVariant={triggerVariant}
      triggerSize={triggerSize}
      title="Registra incasso"
      description={descrizione ?? "Incasso libero, non legato a una rata o a una fattura."}
      action={registraIncassoAction}
    >
      {rataId && <input type="hidden" name="rataId" value={rataId} />}
      {fatturaId && <input type="hidden" name="fatturaId" value={fatturaId} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Importo (€)" name="importo">
          <Input
            name="importo"
            inputMode="decimal"
            required
            defaultValue={importoCent ? formatEuro(importoCent).replace(/[^\d,]/g, "") : ""}
          />
        </Field>
        <Field label="Data" name="data">
          <Input name="data" type="date" required defaultValue={oggi()} />
        </Field>
      </div>
      <Field label="Conto" name="contoId">
        <Select name="contoId" required defaultValue={conti[0]?.id}>
          {conti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Descrizione">
          <Input name="descrizione" />
        </Field>
        <Field label="Riferimento (CRO, ID Stripe…)">
          <Input name="riferimento" />
        </Field>
      </div>
    </FormModal>
  );
}

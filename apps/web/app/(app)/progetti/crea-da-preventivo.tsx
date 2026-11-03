"use client";

import { CATEGORIE_PROGETTO, ETICHETTE_CATEGORIA } from "@telaio/core";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { creaProgettoDaPreventivoAction } from "./actions";

/** Dal preventivo accettato: nome e categoria si scelgono prima di confermare. */
export function CreaProgettoDaPreventivo({
  preventivoId,
  nomeIniziale,
}: {
  preventivoId: string;
  nomeIniziale: string;
}) {
  return (
    <FormModal
      trigger="Crea progetto"
      title="Crea progetto"
      description="Il progetto resta collegato a questo preventivo e al suo cliente."
      submitLabel="Crea progetto"
      action={creaProgettoDaPreventivoAction}
    >
      <input type="hidden" name="preventivoId" value={preventivoId} />
      <Field label="Nome" name="nome">
        <Input name="nome" required maxLength={200} defaultValue={nomeIniziale} />
      </Field>
      <Field label="Categoria" name="categoria">
        <Select name="categoria" defaultValue="altro">
          {CATEGORIE_PROGETTO.map((c) => (
            <option key={c} value={c}>
              {ETICHETTE_CATEGORIA[c]}
            </option>
          ))}
        </Select>
      </Field>
    </FormModal>
  );
}

import { creaContoAction } from "@/app/(app)/conti/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";

/** Modale «Nuovo conto»: corrente, cassa contante o carta. */
export function ContoModal({ emittenti }: { emittenti: { id: string; nome: string }[] }) {
  return (
    <FormModal
      trigger="Nuovo conto"
      title="Nuovo conto"
      description="Conti correnti, cassa contante o carte/POS."
      action={creaContoAction}
    >
      <Field label="Nome" name="nome">
        <Input name="nome" required placeholder="C/C Ditta individuale" />
      </Field>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 14,
        }}
      >
        <Field label="Tipo" name="tipo">
          <Select name="tipo" defaultValue="bonifico">
            <option value="bonifico">Conto corrente (bonifico)</option>
            <option value="contante">Cassa contanti</option>
            <option value="carta">Carte / POS (credito)</option>
          </Select>
        </Field>
        <Field label="Ragione sociale" name="ragioneSocialeId" hint="Vuoto = conto condiviso">
          <Select name="ragioneSocialeId" defaultValue="">
            <option value="">Condiviso</option>
            {emittenti.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="IBAN" name="iban">
          <Input name="iban" />
        </Field>
        <Field label="Saldo iniziale (€)" name="saldoIniziale">
          <Input name="saldoIniziale" inputMode="decimal" defaultValue="0" />
        </Field>
      </div>
    </FormModal>
  );
}

import { registraMovimentoAction } from "@/app/(app)/prima-nota/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";

/** Modale «Nuovo movimento»: entrata, uscita o giroconto tra conti. */
export function MovimentoModal({ conti }: { conti: { id: string; nome: string }[] }) {
  return (
    <FormModal
      trigger="Nuovo movimento"
      triggerSize="sm"
      title="Nuovo movimento"
      action={registraMovimentoAction}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 14,
        }}
      >
        <Field label="Tipo" name="tipo">
          <Select name="tipo" defaultValue="uscita">
            <option value="entrata">Entrata</option>
            <option value="uscita">Uscita</option>
            <option value="giroconto">Giroconto tra conti</option>
          </Select>
        </Field>
        <Field label="Data" name="data">
          <Input name="data" type="date" required defaultValue={oggi()} />
        </Field>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 14,
        }}
      >
        <Field label="Importo (€)" name="importo">
          <Input name="importo" inputMode="decimal" required />
        </Field>
        <Field label="Categoria">
          <Input name="categoria" placeholder="es. Software, Tasse…" />
        </Field>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
          gap: 14,
        }}
      >
        <Field label="Conto" name="contoId">
          <Select name="contoId" required>
            {conti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Conto di destinazione" hint="Solo per i giroconti" name="contoDestinazioneId">
          <Select name="contoDestinazioneId" defaultValue="">
            <option value="">—</option>
            {conti.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Descrizione">
        <Input name="descrizione" />
      </Field>
    </FormModal>
  );
}

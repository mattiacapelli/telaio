import { Card } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { Tag } from "@/components/ui/tag";
import { archiviaRagioneSociale, salvaRagioneSociale } from "../actions";
import type { RagioneSocialeRow } from "./tipi";

const TIPI = [
  ["ditta_individuale", "Ditta individuale"],
  ["srl", "Società (S.r.l.)"],
  ["associazione", "Associazione"],
  ["altro", "Altro"],
] as const;

function Campi({ rs }: { rs?: RagioneSocialeRow }) {
  return (
    <>
      {rs && <input type="hidden" name="id" value={rs.id} />}
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <Field label="Nome / denominazione" name="nome">
          <Input name="nome" defaultValue={rs?.nome} required />
        </Field>
        <Field label="Tipo">
          <Select name="tipo" defaultValue={rs?.tipo ?? "ditta_individuale"}>
            {TIPI.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Partita IVA">
          <Input name="partitaIva" defaultValue={rs?.partitaIva ?? ""} />
        </Field>
        <Field label="Codice fiscale">
          <Input name="codiceFiscale" defaultValue={rs?.codiceFiscale ?? ""} />
        </Field>
      </div>
      <Field label="Indirizzo">
        <Input name="indirizzo" defaultValue={rs?.indirizzo ?? ""} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[110px_1fr_90px]">
        <Field label="CAP">
          <Input name="cap" defaultValue={rs?.cap ?? ""} />
        </Field>
        <Field label="Città">
          <Input name="citta" defaultValue={rs?.citta ?? ""} />
        </Field>
        <Field label="Prov.">
          <Input name="provincia" defaultValue={rs?.provincia ?? ""} maxLength={2} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email">
          <Input name="email" type="email" defaultValue={rs?.email ?? ""} />
        </Field>
        <Field label="PEC">
          <Input name="pec" type="email" defaultValue={rs?.pec ?? ""} />
        </Field>
        <Field label="Codice SDI">
          <Input name="codiceSdi" defaultValue={rs?.codiceSdi ?? ""} />
        </Field>
        <Field label="IBAN">
          <Input name="iban" defaultValue={rs?.iban ?? ""} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Formato numero preventivo"
          hint="Token: {AAAA} {AA} {N} {NNN}"
          name="formatoPreventivo"
        >
          <Input
            name="formatoPreventivo"
            defaultValue={rs?.formatoPreventivo ?? "P-{AAAA}-{NNN}"}
          />
        </Field>
        <Field label="Formato numero fattura" name="formatoFattura">
          <Input name="formatoFattura" defaultValue={rs?.formatoFattura ?? "F-{AAAA}-{NNN}"} />
        </Field>
      </div>
    </>
  );
}

export function SezioneRagioniSociali({ elenco }: { elenco: RagioneSocialeRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <FormModal
          trigger="Nuova ragione sociale"
          title="Nuova ragione sociale"
          description="Un emittente di preventivi e fatture, con la sua numerazione."
          action={salvaRagioneSociale}
        >
          <Campi />
        </FormModal>
      </div>
      {elenco.map((rs) => (
        <Card key={rs.id} className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-semibold">{rs.nome}</h2>
            <p className="mt-1 text-sm text-muted">
              {[
                rs.partitaIva && `P.IVA ${rs.partitaIva}`,
                rs.codiceFiscale && `CF ${rs.codiceFiscale}`,
                rs.citta,
              ]
                .filter(Boolean)
                .join(" · ") || "Dati anagrafici da completare"}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag tone="ink">Preventivi {rs.formatoPreventivo}</Tag>
              <Tag tone="ink">Fatture {rs.formatoFattura}</Tag>
              <Tag tone={rs.ivaAttiva ? "blue" : "orange"}>
                {rs.ivaAttiva ? "Con IVA" : "Senza IVA"}
              </Tag>
            </div>
          </div>
          <div className="flex gap-2">
            <FormModal
              trigger="Modifica"
              triggerVariant="ghost"
              triggerSize="sm"
              title={`Modifica ${rs.nome}`}
              action={salvaRagioneSociale}
            >
              <Campi rs={rs} />
            </FormModal>
            <FormModal
              trigger="Archivia"
              triggerVariant="ghost"
              triggerSize="sm"
              title="Archiviare la ragione sociale?"
              description="Sparisce dagli elenchi, i documenti già emessi restano invariati."
              submitLabel="Archivia"
              action={archiviaRagioneSociale}
            >
              <input type="hidden" name="id" value={rs.id} />
              <p className="text-sm">{rs.nome}</p>
            </FormModal>
          </div>
        </Card>
      ))}
    </div>
  );
}

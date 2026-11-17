import { modificaTempoAction, registraTempoAction } from "@/app/(app)/tempo/actions";
import { Checkbox, Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";

interface Opt {
  id: string;
  nome: string;
}

export interface OpzioniTempo {
  clienti: Opt[];
  /** contratti attivi: `nome` è già «Cliente · Contratto» */
  contratti: Opt[];
}

export interface VoceModificabile {
  id: string;
  clienteRefId: string;
  monteOreId: string | null;
  ticketId: string | null;
  data: string;
  minutiEffettivi: number;
  descrizione: string | null;
  fatturabile: boolean;
}

export const comeDurata = (minuti: number) =>
  `${Math.floor(minuti / 60)}:${String(minuti % 60).padStart(2, "0")}`;

/** Registra tempo già lavorato, o modifica una voce. */
export function TempoModal({
  opzioni,
  voce,
  contrattoId,
  trigger = "Registra tempo",
  triggerVariant,
}: {
  opzioni: OpzioniTempo;
  voce?: VoceModificabile;
  /** precompila il contratto (dalla sua pagina) */
  contrattoId?: string;
  trigger?: React.ReactNode;
  triggerVariant?: "primary" | "secondary" | "ghost";
}) {
  return (
    <FormModal
      trigger={trigger}
      triggerVariant={triggerVariant ?? (voce ? "ghost" : "primary")}
      triggerSize={voce ? "sm" : undefined}
      title={voce ? "Modifica tempo" : "Registra tempo"}
      description="Con un contratto a ore la durata conta arrotondata per eccesso al suo passo."
      action={voce ? modificaTempoAction : registraTempoAction}
    >
      {voce && <input type="hidden" name="id" value={voce.id} />}
      {voce?.ticketId && <input type="hidden" name="ticketId" value={voce.ticketId} />}
      <Field label="Contratto a ore" hint="Facoltativo" name="monteOreId">
        <Select name="monteOreId" defaultValue={voce?.monteOreId ?? contrattoId ?? ""}>
          <option value="">Nessun contratto</option>
          {opzioni.contratti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Cliente" hint="Serve se non scegli un contratto" name="clienteRefId">
        <Select name="clienteRefId" defaultValue={voce?.clienteRefId ?? ""}>
          <option value="">—</option>
          {opzioni.clienti.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Data" name="data">
          <Input name="data" type="date" required defaultValue={voce?.data ?? oggi()} />
        </Field>
        <Field label="Durata" hint="1:30, 1h30, 90m o 1,5 (ore)" name="durata">
          <Input
            name="durata"
            required
            autoComplete="off"
            placeholder="1:30"
            defaultValue={voce ? comeDurata(voce.minutiEffettivi) : ""}
          />
        </Field>
      </div>
      <Field label="Descrizione" hint="Facoltativa" name="descrizione">
        <Input name="descrizione" maxLength={500} defaultValue={voce?.descrizione ?? ""} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="fatturabile" defaultChecked={voce?.fatturabile ?? true} />
        Fatturabile
      </label>
    </FormModal>
  );
}

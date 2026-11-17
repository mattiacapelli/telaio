import { PASSI_ARROTONDAMENTO } from "@telaio/core";
import { creaMonteOreAction, modificaMonteOreAction } from "@/app/(app)/monte-ore/actions";
import { Field, Input, Select } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";

export interface MonteOreModificabile {
  id: string;
  nome: string;
  ragioneSocialeId: string;
  /** testo già pronto, es. «10» o «7:30» */
  oreIncluse: string;
  tariffaOraria: string;
  tariffaExtra: string;
  arrotondamentoMinuti: number;
  dataInizio: string;
  dataFine: string | null;
}

/** Nuovo contratto a ore, o modifica di uno esistente. */
export function MonteOreModal({
  clienti,
  emittenti,
  contratto,
  clienteRefId,
}: {
  clienti?: { id: string; nome: string }[];
  emittenti: { id: string; nome: string }[];
  contratto?: MonteOreModificabile;
  /** precompila il cliente (dalla sua scheda) */
  clienteRefId?: string;
}) {
  return (
    <FormModal
      trigger={contratto ? "Modifica" : "Nuovo monte ore"}
      triggerVariant={contratto ? "secondary" : "primary"}
      triggerSize={contratto ? undefined : "sm"}
      title={contratto ? "Modifica contratto a ore" : "Nuovo contratto a ore"}
      description="Ore incluse in ogni periodo mensile, che parte dal giorno di inizio. Le ore non usate decadono a fine periodo."
      action={contratto ? modificaMonteOreAction : creaMonteOreAction}
    >
      {contratto && <input type="hidden" name="id" value={contratto.id} />}
      {!contratto && (
        <Field label="Cliente" name="clienteRefId">
          <Select name="clienteRefId" required defaultValue={clienteRefId ?? ""}>
            <option value="" disabled>
              Scegli il cliente
            </option>
            {clienti?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Field
        label="Emittente"
        hint="Intesta le fatture delle ore extra e l'estratto"
        name="ragioneSocialeId"
      >
        <Select
          name="ragioneSocialeId"
          required
          defaultValue={contratto?.ragioneSocialeId ?? emittenti[0]?.id ?? ""}
        >
          {emittenti.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nome" name="nome">
        <Input
          name="nome"
          required
          maxLength={150}
          placeholder="Assistenza sito"
          defaultValue={contratto?.nome}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ore incluse per periodo" hint="10, 10:30 o 600m" name="oreIncluse">
          <Input name="oreIncluse" required defaultValue={contratto?.oreIncluse} />
        </Field>
        <Field label="Arrotondamento" hint="Si arrotonda per eccesso" name="arrotondamentoMinuti">
          <Select name="arrotondamentoMinuti" defaultValue={contratto?.arrotondamentoMinuti ?? 15}>
            {PASSI_ARROTONDAMENTO.map((p) => (
              <option key={p} value={p}>
                {p === 60 ? "1 ora" : `${p} minuti`}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Inizio" hint="Il giorno del mese fissa i periodi" name="dataInizio">
          <Input
            name="dataInizio"
            type="date"
            required
            defaultValue={contratto?.dataInizio ?? oggi()}
          />
        </Field>
        <Field label="Fine" hint="Facoltativa" name="dataFine">
          <Input name="dataFine" type="date" defaultValue={contratto?.dataFine ?? ""} />
        </Field>
        <Field label="Tariffa oraria (€)" hint="Facoltativa" name="tariffaOraria">
          <Input name="tariffaOraria" inputMode="decimal" defaultValue={contratto?.tariffaOraria} />
        </Field>
        <Field label="Tariffa ore extra (€)" hint="Oltre il monte" name="tariffaExtra">
          <Input name="tariffaExtra" inputMode="decimal" defaultValue={contratto?.tariffaExtra} />
        </Field>
      </div>
    </FormModal>
  );
}

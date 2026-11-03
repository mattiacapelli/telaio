"use client";

import {
  AMBIENTI_RISORSA,
  ETICHETTE_AMBIENTE,
  ETICHETTE_STATO_PROGETTO,
  ETICHETTE_TIPO_RISORSA,
  STATI_PROGETTO,
  TIPI_RISORSA,
} from "@telaio/core";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal } from "@/components/ui/form-modal";
import {
  aggiungiRisorsaAction,
  cambiaStatoProgettoAction,
  eliminaRisorsaAction,
  modificaRisorsaAction,
} from "../actions";

export interface RisorsaForm {
  id: string;
  tipo: string;
  titolo: string;
  url: string;
  descrizione: string;
  ambiente: string;
  principale: boolean;
}

function CampiRisorsa({ r }: { r?: RisorsaForm }) {
  return (
    <>
      <Field label="Tipo" name="tipo">
        <Select name="tipo" defaultValue={r?.tipo ?? "repository"}>
          {TIPI_RISORSA.map((t) => (
            <option key={t} value={t}>
              {ETICHETTE_TIPO_RISORSA[t]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Titolo" name="titolo">
        <Input name="titolo" required maxLength={200} defaultValue={r?.titolo} />
      </Field>
      <Field
        label="Indirizzo"
        name="url"
        hint="http o https. Non inserire password o token nell'indirizzo."
      >
        <Input name="url" type="url" required placeholder="https://" defaultValue={r?.url} />
      </Field>
      <Field label="Ambiente" name="ambiente">
        <Select name="ambiente" defaultValue={r?.ambiente ?? ""}>
          <option value="">Nessuno</option>
          {AMBIENTI_RISORSA.map((a) => (
            <option key={a} value={a}>
              {ETICHETTE_AMBIENTE[a]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Descrizione" name="descrizione">
        <Textarea name="descrizione" rows={2} maxLength={1000} defaultValue={r?.descrizione} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox name="principale" defaultChecked={r?.principale} />
        Collegamento principale del progetto
      </label>
    </>
  );
}

export function AggiungiRisorsa({ progettoId }: { progettoId: string }) {
  return (
    <FormModal
      trigger={
        <>
          <Plus /> Aggiungi risorsa
        </>
      }
      triggerVariant="secondary"
      triggerSize="sm"
      title="Aggiungi risorsa"
      description="Un collegamento esterno: repository, design, ambienti, documentazione."
      submitLabel="Aggiungi"
      action={aggiungiRisorsaAction}
    >
      <input type="hidden" name="progettoId" value={progettoId} />
      <CampiRisorsa />
    </FormModal>
  );
}

export function ModificaRisorsa({ risorsa }: { risorsa: RisorsaForm }) {
  return (
    <FormModal
      trigger={<Pencil aria-label={`Modifica ${risorsa.titolo}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Modifica risorsa"
      action={modificaRisorsaAction}
    >
      <input type="hidden" name="id" value={risorsa.id} />
      <CampiRisorsa r={risorsa} />
    </FormModal>
  );
}

export function EliminaRisorsa({ id, titolo }: { id: string; titolo: string }) {
  return (
    <FormModal
      trigger={<Trash2 aria-label={`Elimina ${titolo}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Elimina risorsa"
      description={`Vuoi eliminare «${titolo}»? Il collegamento viene rimosso dal progetto.`}
      submitLabel="Elimina"
      action={eliminaRisorsaAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}

export function CambiaStato({ id, stato }: { id: string; stato: string }) {
  return (
    <FormModal
      trigger="Cambia stato"
      triggerVariant="secondary"
      title="Cambia stato"
      description="Le date effettive di inizio e fine si aggiornano di conseguenza."
      submitLabel="Aggiorna"
      action={cambiaStatoProgettoAction}
    >
      <input type="hidden" name="id" value={id} />
      <Field label="Stato" name="stato">
        <Select name="stato" defaultValue={stato}>
          {STATI_PROGETTO.map((s) => (
            <option key={s} value={s}>
              {ETICHETTE_STATO_PROGETTO[s]}
            </option>
          ))}
        </Select>
      </Field>
    </FormModal>
  );
}

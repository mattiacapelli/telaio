"use client";

import {
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_TICKET,
  ETICHETTE_TIPO_TICKET,
  PRIORITA_TICKET,
  STATI_TICKET,
  type StatoTicket,
  TIPI_TICKET,
} from "@telaio/core";
import { Plus, Trash2 } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import {
  commentaTicketAction,
  creaTicketAction,
  eliminaCommentoAction,
  eliminaTicketAction,
  modificaTicketAction,
} from "@/app/(app)/progetti/ticket-actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { FormModal, initialState } from "@/components/ui/form-modal";

export interface Utente {
  id: string;
  nome: string;
}

export interface TicketForm {
  id: string;
  titolo: string;
  descrizione: string;
  tipo: string;
  stato: string;
  priorita: string;
  assegnatarioId: string;
  scadenza: string;
}

function CampiTicket({
  t,
  utenti,
  stato,
  assegnatarioPredefinito,
}: {
  t?: TicketForm;
  utenti: Utente[];
  stato?: StatoTicket;
  assegnatarioPredefinito?: string;
}) {
  return (
    <>
      <Field label="Titolo" name="titolo">
        <Input name="titolo" required maxLength={200} defaultValue={t?.titolo} autoFocus />
      </Field>
      <Field label="Descrizione" name="descrizione">
        <Textarea name="descrizione" rows={4} maxLength={10000} defaultValue={t?.descrizione} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tipo" name="tipo">
          <Select name="tipo" defaultValue={t?.tipo ?? "attivita"}>
            {TIPI_TICKET.map((x) => (
              <option key={x} value={x}>
                {ETICHETTE_TIPO_TICKET[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Stato" name="stato">
          <Select name="stato" defaultValue={t?.stato ?? stato ?? "da_fare"}>
            {STATI_TICKET.map((x) => (
              <option key={x} value={x}>
                {ETICHETTE_STATO_TICKET[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Priorità" name="priorita">
          <Select name="priorita" defaultValue={t?.priorita ?? "normale"}>
            {PRIORITA_TICKET.map((x) => (
              <option key={x} value={x}>
                {ETICHETTE_PRIORITA[x]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Assegnato a" name="assegnatarioId">
          <Select
            name="assegnatarioId"
            defaultValue={t?.assegnatarioId ?? assegnatarioPredefinito ?? ""}
          >
            <option value="">Nessuno</option>
            {utenti.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Scadenza" name="scadenza">
        <Input name="scadenza" type="date" defaultValue={t?.scadenza} />
      </Field>
    </>
  );
}

export function NuovoTicket({
  progettoId,
  progetti,
  utenti,
  stato,
  etichetta = "Nuovo ticket",
  assegnatarioPredefinito,
}: {
  /** progetto già noto (lavagna del progetto)… */
  progettoId?: string;
  /** …oppure i progetti tra cui scegliere (elenco di tutti i ticket) */
  progetti?: { id: string; etichetta: string }[];
  utenti: Utente[];
  stato?: StatoTicket;
  etichetta?: string;
  /** utente già scelto in «Assegnato a» (assegnazione automatica) */
  assegnatarioPredefinito?: string;
}) {
  return (
    <FormModal
      trigger={
        <>
          <Plus /> {etichetta}
        </>
      }
      title="Nuovo ticket"
      description="Il numero lo assegna il sistema; finisce in fondo alla colonna scelta."
      submitLabel="Crea"
      action={creaTicketAction}
    >
      {progettoId ? (
        <input type="hidden" name="progettoId" value={progettoId} />
      ) : (
        <Field label="Progetto" name="progettoId">
          <Select name="progettoId" required defaultValue="">
            <option value="" disabled>
              Scegli il progetto
            </option>
            {progetti?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.etichetta}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <CampiTicket
        utenti={utenti}
        stato={stato}
        assegnatarioPredefinito={assegnatarioPredefinito}
      />
    </FormModal>
  );
}

export function ModificaTicket({ ticket, utenti }: { ticket: TicketForm; utenti: Utente[] }) {
  return (
    <FormModal
      trigger="Modifica"
      triggerVariant="secondary"
      title="Modifica ticket"
      action={modificaTicketAction}
    >
      <input type="hidden" name="id" value={ticket.id} />
      <CampiTicket t={ticket} utenti={utenti} />
    </FormModal>
  );
}

export function EliminaTicket({ id, codice }: { id: string; codice: string }) {
  return (
    <FormModal
      trigger={<Trash2 aria-label={`Elimina ${codice}`} />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Elimina ticket"
      description={`Vuoi eliminare ${codice}? Esce dalla lavagna; resta nello storico del progetto.`}
      submitLabel="Elimina"
      action={eliminaTicketAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}

export function EliminaCommento({ id }: { id: string }) {
  return (
    <FormModal
      trigger={<Trash2 aria-label="Elimina il commento" />}
      triggerVariant="ghost"
      triggerSize="icon"
      title="Elimina commento"
      description="Vuoi eliminare questo commento?"
      submitLabel="Elimina"
      action={eliminaCommentoAction}
    >
      <input type="hidden" name="id" value={id} />
    </FormModal>
  );
}

/** Scrive un commento sotto il ticket; i campi si svuotano solo a salvataggio riuscito. */
export function NuovoCommento({ ticketId }: { ticketId: string }) {
  const modulo = useRef<HTMLFormElement>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [pending, avvia] = useTransition();
  return (
    <form
      ref={modulo}
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const dati = new FormData(e.currentTarget);
        avvia(async () => {
          const r = await commentaTicketAction(initialState, dati);
          if (r.ok) {
            modulo.current?.reset();
            setErrore(null);
          } else setErrore(r.errors?.testo ?? r.message ?? "Commento non salvato");
        });
      }}
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      <Textarea
        name="testo"
        rows={3}
        maxLength={5000}
        required
        placeholder="Scrivi un commento…"
        aria-label="Commento"
      />
      {errore && (
        <p role="alert" className="text-sm font-medium text-bad">
          {errore}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Invio…" : "Commenta"}
        </Button>
      </div>
    </form>
  );
}

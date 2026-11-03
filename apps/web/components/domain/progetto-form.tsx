"use client";

import {
  CATEGORIE_PROGETTO,
  ETICHETTE_CATEGORIA,
  ETICHETTE_PRIORITA,
  ETICHETTE_STATO_PROGETTO,
  PRIORITA_PROGETTO,
  STATI_PROGETTO,
} from "@telaio/core";
import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { type ActionState, initialState } from "@/components/ui/form-modal";
import { PageHeader } from "@/components/ui/page-header";
import { STATO_PROGETTO } from "@/lib/stati";
import type { ValoriProgetto } from "./progetto-valori";

/** Form di creazione e modifica di un progetto: gruppi di campi in schede, errori sotto ogni campo. */
export function ProgettoForm({
  azione,
  iniziale,
  clienti,
  preventivi,
  utenti,
  annullaHref,
}: {
  azione: (prev: ActionState, data: FormData) => Promise<ActionState>;
  iniziale: ValoriProgetto;
  clienti: { id: string; nome: string }[];
  preventivi: { id: string; etichetta: string }[];
  utenti: { id: string; nome: string }[];
  annullaHref: string;
}) {
  const [stato, formAction, pendingAzione] = useActionState(azione, initialState);
  const [inTransizione, avvia] = useTransition();
  const pending = pendingAzione || inTransizione;
  const [inizio, setInizio] = useState(iniziale.dataInizioPrevista);
  const [fine, setFine] = useState(iniziale.dataFinePrevista);
  const modifica = !!iniziale.id;
  const e = stato.errors ?? {};
  const fineIncoerente = !!inizio && !!fine && fine < inizio;

  // onSubmit e non action=: con action= React svuota i campi dopo ogni invio, anche in caso d'errore.
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        const dati = new FormData(ev.currentTarget);
        avvia(() => formAction(dati));
      }}
      className="contents"
    >
      {iniziale.id && <input type="hidden" name="id" value={iniziale.id} />}
      <PageHeader
        titolo={modifica ? `Modifica ${iniziale.codice}` : "Nuovo progetto"}
        descrizione={
          modifica
            ? iniziale.nome
            : "Una commessa per un cliente. Il codice lo assegna il sistema al salvataggio."
        }
        stato={
          modifica ? (
            <Badge variant={STATO_PROGETTO[iniziale.stato]?.variante} dot>
              {STATO_PROGETTO[iniziale.stato]?.label}
            </Badge>
          ) : undefined
        }
        azioni={
          <>
            <Button asChild variant="ghost">
              <Link href={annullaHref}>Annulla</Link>
            </Button>
            <Button type="submit" disabled={pending || fineIncoerente}>
              {pending ? "Salvataggio…" : modifica ? "Salva modifiche" : "Crea progetto"}
            </Button>
          </>
        }
      />

      {stato.message && !stato.ok && (
        <p
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {stato.message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="flex flex-col gap-4">
          <CardHeader title="Informazioni generali" />
          <Field label="Nome" error={e.nome}>
            <Input
              name="nome"
              required
              maxLength={200}
              defaultValue={iniziale.nome}
              placeholder="Es. Sito vetrina Trattoria Da Marco"
            />
          </Field>
          <Field label="Codice" hint="Generato dal sistema, non modificabile">
            <Input
              value={iniziale.codice ?? "Assegnato al salvataggio"}
              readOnly
              disabled
              aria-label="Codice progetto"
            />
          </Field>
          <Field label="Categoria" error={e.categoria}>
            <Select name="categoria" defaultValue={iniziale.categoria}>
              {CATEGORIE_PROGETTO.map((c) => (
                <option key={c} value={c}>
                  {ETICHETTE_CATEGORIA[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Descrizione" error={e.descrizione}>
            <Textarea
              name="descrizione"
              rows={4}
              maxLength={5000}
              defaultValue={iniziale.descrizione}
            />
          </Field>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="flex flex-col gap-4">
            <CardHeader
              title="Cliente e riferimenti"
              description="Il cliente resta gestito su Twenty"
            />
            <Field label="Cliente" hint="Puoi assegnarlo anche dopo" error={e.clienteTwentyId}>
              <Select name="clienteTwentyId" defaultValue={iniziale.clienteTwentyId}>
                <option value="">Nessun cliente</option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Preventivo"
              hint="Opzionale: solo preventivi accettati. Un preventivo può avere più progetti"
              error={e.preventivoId}
            >
              <Select name="preventivoId" defaultValue={iniziale.preventivoId}>
                <option value="">Nessun preventivo</option>
                {preventivi.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.etichetta}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>

          <Card className="grid gap-4 sm:grid-cols-2">
            <CardHeader title="Gestione" className="sm:col-span-2" />
            <Field label="Responsabile" error={e.responsabileId} className="sm:col-span-2">
              <Select name="responsabileId" defaultValue={iniziale.responsabileId}>
                <option value="">Nessun responsabile</option>
                {utenti.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nome}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stato" error={e.stato}>
              <Select name="stato" defaultValue={iniziale.stato}>
                {STATI_PROGETTO.map((s) => (
                  <option key={s} value={s}>
                    {ETICHETTE_STATO_PROGETTO[s]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Priorità" error={e.priorita}>
              <Select name="priorita" defaultValue={iniziale.priorita}>
                {PRIORITA_PROGETTO.map((p) => (
                  <option key={p} value={p}>
                    {ETICHETTE_PRIORITA[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </Card>
        </div>
      </div>

      <Card className="grid gap-4 sm:grid-cols-2">
        <CardHeader
          title="Pianificazione"
          description="Le date effettive si registrano da sole quando cambi lo stato"
          className="sm:col-span-2"
        />
        <Field label="Inizio previsto" error={e.dataInizioPrevista}>
          <Input
            type="date"
            name="dataInizioPrevista"
            value={inizio}
            onChange={(ev) => setInizio(ev.target.value)}
          />
        </Field>
        <Field
          label="Fine prevista"
          error={
            e.dataFinePrevista ??
            (fineIncoerente ? "La fine non può precedere l'inizio" : undefined)
          }
        >
          <Input
            type="date"
            name="dataFinePrevista"
            min={inizio || undefined}
            value={fine}
            onChange={(ev) => setFine(ev.target.value)}
          />
        </Field>
      </Card>
    </form>
  );
}

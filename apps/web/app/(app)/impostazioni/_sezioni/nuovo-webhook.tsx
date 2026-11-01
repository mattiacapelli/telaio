"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input } from "@/components/ui/field";
import { EVENTI_WEBHOOK } from "@/lib/eventi-webhook";
import { creaWebhook } from "../actions";

/** Nuovo webhook: il segreto di firma compare una sola volta, subito dopo la creazione. */
export function NuovoWebhook() {
  const [stato, azione, pending] = useActionState(creaWebhook, { ok: false });
  const e = stato.errors ?? {};

  if (stato.ok && stato.secret) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle p-4">
        <p className="text-sm font-medium">
          Copia ora il segreto di firma: non verrà mostrato di nuovo
        </p>
        <code className="overflow-x-auto rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs">
          {stato.secret}
        </code>
        <p className="text-xs text-fg-2">
          Ogni consegna ha l&apos;intestazione{" "}
          <code className="font-mono">x-telaio-signature: sha256=…</code> (HMAC-SHA256 del corpo).
        </p>
      </div>
    );
  }

  return (
    <form action={azione} className="flex flex-col gap-4">
      <Field label="Indirizzo che riceve gli eventi" error={e.url}>
        <Input name="url" type="url" placeholder="https://esempio.it/telaio/webhook" required />
      </Field>
      <fieldset className="grid gap-x-6 gap-y-1 border-0 p-0 sm:grid-cols-2">
        <legend className="mb-1.5 text-sm font-medium">Eventi</legend>
        {EVENTI_WEBHOOK.map((ev) => (
          <label key={ev.nome} className="flex min-h-10 items-start gap-2.5 py-1.5 text-sm">
            <Checkbox name="eventi[]" value={ev.nome} className="mt-0.5" />
            <span className="flex flex-col leading-snug">
              <span className="font-mono text-xs font-medium">{ev.nome}</span>
              <span className="text-xs text-fg-2">{ev.descrizione}</span>
            </span>
          </label>
        ))}
        {e.eventi && (
          <span role="alert" className="text-xs font-medium text-bad sm:col-span-2">
            {e.eventi}
          </span>
        )}
      </fieldset>
      <div>
        <Button type="submit" size="sm" disabled={pending}>
          Aggiungi webhook
        </Button>
      </div>
    </form>
  );
}

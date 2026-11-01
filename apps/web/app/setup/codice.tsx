"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { verificaCodice } from "./actions";

/** Accesso al wizard con il codice di setup (SETUP_TOKEN), controllato solo dal server. */
export function CodiceSetup() {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const codice = String(new FormData(e.currentTarget).get("codice") ?? "");
        setErrore(null);
        avvia(async () => {
          const r = await verificaCodice(codice);
          if (r.ok) router.refresh();
          else setErrore(r.messaggio ?? "Codice non corretto.");
        });
      }}
    >
      <p className="text-sm text-fg-2">
        Per evitare che qualcun altro configuri questo server al tuo posto, la prima configurazione
        richiede il codice impostato in <code className="font-mono text-xs">SETUP_TOKEN</code>.
      </p>
      <Field label="Codice di setup" error={errore ?? undefined}>
        <Input
          name="codice"
          type="password"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          required
          autoFocus
        />
      </Field>
      <Button type="submit" disabled={inCorso} className="h-9">
        {inCorso ? "Verifica…" : "Continua"}
      </Button>
    </form>
  );
}

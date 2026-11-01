"use client";

import { Check, Copy } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { creaChiaveApi } from "../actions";

/** Creazione chiave: la chiave in chiaro compare una sola volta, subito dopo la creazione. */
export function NuovaChiaveApi() {
  const [stato, azione, pending] = useActionState(creaChiaveApi, { ok: false });
  const [copiata, setCopiata] = useState(false);
  const e = stato.errors ?? {};

  if (stato.ok && stato.chiave) {
    return (
      <div className="rounded-lg bg-fg text-on-fg p-5">
        <p className="text-xs font-medium text-on-fg/70">
          Copia ora la chiave: non verrà mostrata di nuovo
        </p>
        <div className="mt-3 flex items-center gap-3">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg bg-on-fg/10 px-4 py-3 text-sm">
            {stato.chiave}
          </code>
          <Button
            variant="glass"
            size="icon"
            aria-label="Copia la chiave"
            onClick={async () => {
              await navigator.clipboard.writeText(stato.chiave ?? "");
              setCopiata(true);
            }}
          >
            {copiata ? <Check /> : <Copy />}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form action={azione} className="grid gap-4 sm:grid-cols-[1fr_200px_auto] sm:items-end">
      <Field label="Nome della chiave" error={e.nome}>
        <Input name="nome" placeholder="es. Claude Desktop" required />
      </Field>
      <Field label="Permessi">
        <Select name="permessi" defaultValue="lettura">
          <option value="lettura">Solo lettura</option>
          <option value="lettura_scrittura">Lettura e scrittura</option>
        </Select>
      </Field>
      <Button type="submit" disabled={pending}>
        Crea chiave
      </Button>
      <fieldset className="flex gap-4 sm:col-span-3">
        <legend className="sr-only">Ambiti</legend>
        {(["api", "mcp"] as const).map((s) => (
          <label key={s} className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="scopes[]"
              value={s}
              defaultChecked={s === "api"}
              className="size-4 accent-[var(--brand)]"
            />
            {s === "api" ? "API REST" : "Server MCP"}
          </label>
        ))}
        {e.scopes && (
          <span role="alert" className="text-xs text-bad">
            {e.scopes}
          </span>
        )}
      </fieldset>
    </form>
  );
}

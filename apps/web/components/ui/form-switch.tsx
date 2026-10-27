"use client";

import { useState } from "react";
import { Switch } from "./switch";

/** Interruttore dentro un form: invia name=on quando attivo. */
export function FormSwitch({
  name,
  label,
  description,
  defaultChecked = false,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-grey-2 bg-white/50 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
      <Switch label={label} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? "on" : ""} />
    </div>
  );
}

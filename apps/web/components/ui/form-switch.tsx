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
    <div className="flex items-center justify-between gap-4 border-t border-line py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-sm text-fg-2">{description}</span>}
      </div>
      <Switch label={label} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? "on" : ""} />
    </div>
  );
}

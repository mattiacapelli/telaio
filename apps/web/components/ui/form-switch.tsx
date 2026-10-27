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
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "12px 0",
        borderTop: "1px solid rgba(23,21,15,.08)",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{label}</span>
        {description && (
          <span style={{ fontSize: 13, color: "#3a372f", lineHeight: 1.5 }}>{description}</span>
        )}
      </div>
      <Switch label={label} checked={checked} onCheckedChange={setChecked} />
      <input type="hidden" name={name} value={checked ? "on" : ""} />
    </div>
  );
}

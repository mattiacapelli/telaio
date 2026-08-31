"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

const STATI: Record<string, string> = {
  ATTIVA: "Attiva",
  SOSPESA: "Sospesa",
  SCADUTA: "Scaduta",
  DISDETTA: "Disdetta",
};

export function StatoLicenza({ id, stato }: { id: string; stato: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);

  async function cambia(nuovo: string) {
    setInCorso(true);
    const r = await fetch(`/api/licenze/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato: nuovo }),
    }).catch(() => null);
    setInCorso(false);
    if (r?.ok) router.refresh();
  }

  return (
    <Select
      value={stato}
      onChange={(e) => cambia(e.target.value)}
      disabled={inCorso}
      className="h-6 w-28 text-xs"
    >
      {Object.entries(STATI).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </Select>
  );
}

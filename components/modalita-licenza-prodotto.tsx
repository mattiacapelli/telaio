"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

const MODALITA: Record<string, string> = {
  NESSUNA: "Nessuna",
  ONLINE: "Verifica online",
  OFFLINE: "Firma offline",
  ENTRAMBE: "Entrambe",
};

export function ModalitaLicenzaProdotto({ id, modalita }: { id: string; modalita: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);

  async function cambia(nuova: string) {
    setInCorso(true);
    const r = await fetch(`/api/prodotti/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modalitaLicenza: nuova }),
    }).catch(() => null);
    setInCorso(false);
    if (r?.ok) router.refresh();
  }

  return (
    <Select value={modalita} onChange={(e) => cambia(e.target.value)} disabled={inCorso}>
      {Object.entries(MODALITA).map(([v, l]) => (
        <option key={v} value={v}>{l}</option>
      ))}
    </Select>
  );
}

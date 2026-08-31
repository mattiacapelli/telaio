"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Entita } from "@/lib/eliminazione";

/**
 * Sposta un record nel cestino (soft delete).
 *
 * Non elimina mai a cascata: se il record ha figli, l'API rifiuta e qui si
 * mostra il motivo — l'utente deve prima occuparsene lui, non il codice al
 * suo posto.
 */
export function EliminaRecord({
  entita,
  id,
  nome,
  dopoRedirect,
  variant = "outline",
  size = "sm",
}: {
  entita: Entita;
  id: string;
  nome: string;
  /** Se indicato, dopo l'eliminazione si naviga qui invece di fare refresh. */
  dopoRedirect?: string;
  variant?: "outline" | "ghost" | "danger";
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function elimina() {
    if (!confirm(`Spostare «${nome}» nel cestino?`)) return;
    setErrore(null);
    setInCorso(true);
    const r = await fetch(`/api/cestino/${entita}/${id}`, { method: "DELETE" }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Eliminazione non riuscita");
      return;
    }
    if (dopoRedirect) router.push(dopoRedirect);
    else router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant={variant} size={size} onClick={elimina} disabled={inCorso}>
        {inCorso ? <Loader2 className="animate-spin" /> : <Trash2 />}
        {inCorso ? "Elimino…" : "Elimina"}
      </Button>
      {errore && <span className="max-w-[220px] text-right text-xs text-neg">{errore}</span>}
    </div>
  );
}

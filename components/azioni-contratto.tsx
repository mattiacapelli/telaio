"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Receipt, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Attivazione, sospensione e fatturazione del canone. */
export function AzioniContratto({
  contratto,
}: {
  contratto: { id: string; stato: string; tipo: string; numero: string };
}) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [esito, setEsito] = useState<string | null>(null);

  async function chiama(url: string, opzioni: RequestInit, messaggio?: string) {
    setInCorso(true);
    setEsito(null);
    const r = await fetch(url, opzioni).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setEsito(d?.errore ?? "Operazione non riuscita");
      return;
    }
    if (messaggio) setEsito(messaggio);
    router.refresh();
  }

  const attivo = contratto.stato === "ATTIVO";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex flex-wrap justify-center gap-1.5">
        <Button size="sm" variant="outline" asChild>
          <a href={`/api/contratti/${contratto.id}/pdf`} target="_blank" rel="noopener">
            <FileDown /> PDF
          </a>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={inCorso}
          onClick={() =>
            chiama(`/api/contratti/${contratto.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ stato: attivo ? "SOSPESO" : "ATTIVO" }),
            })
          }
        >
          {attivo ? <><Pause /> Sospendi</> : <><Play /> Attiva</>}
        </Button>
        {attivo && (
          <Button
            size="sm"
            disabled={inCorso}
            onClick={() =>
              chiama(
                `/api/contratti/${contratto.id}/fattura`,
                { method: "POST" },
                "Fattura creata",
              )
            }
          >
            <Receipt /> Fattura canone
          </Button>
        )}
      </div>
      {esito && <div className="text-center text-xs text-muted">{esito}</div>}
    </div>
  );
}

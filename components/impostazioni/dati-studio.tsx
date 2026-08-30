"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";

/** Modifica dei dati che finiscono nei documenti. */
export function ModificaDatiStudio({
  valori,
  campi,
  titolo,
}: {
  valori: Record<string, string>;
  campi: {
    chiave: string;
    etichetta: string;
    tipo?: "testo" | "numero" | "scelta";
    opzioni?: { valore: string; etichetta: string }[];
    nota?: string;
  }[];
  titolo: string;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [d, setD] = useState(valori);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/impostazioni", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setAperto(false);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil /> Modifica</Button>
      </DialogTrigger>
      <DialogContent titolo={titolo}>
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            {campi.map((c) => (
              <Campo key={c.chiave} etichetta={c.etichetta} nota={c.nota}>
                {c.tipo === "scelta" ? (
                  <Select
                    value={d[c.chiave] ?? ""}
                    onChange={(e) => setD({ ...d, [c.chiave]: e.target.value })}
                  >
                    {(c.opzioni ?? []).map((o) => (
                      <option key={o.valore} value={o.valore}>{o.etichetta}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={d[c.chiave] ?? ""}
                    onChange={(e) => setD({ ...d, [c.chiave]: e.target.value })}
                    inputMode={c.tipo === "numero" ? "decimal" : undefined}
                    className={c.tipo === "numero" ? "text-right" : undefined}
                  />
                )}
              </Campo>
            ))}

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>
          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

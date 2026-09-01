"use client";

import { useState } from "react";
import { Download, AlertTriangle } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";

export function GeneraFileLicenza({ licenzaId }: { licenzaId: string }) {
  const [aperto, setAperto] = useState(false);
  const [seats, setSeats] = useState("");
  const [moduli, setModuli] = useState("");
  const [hardwareId, setHardwareId] = useState("");
  const [validita, setValidita] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function genera(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);

    const r = await fetch(`/api/licenze/${licenzaId}/file`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seats: seats === "" ? undefined : Number(seats),
        moduli: moduli.trim() ? moduli.split(",").map((m) => m.trim()).filter(Boolean) : undefined,
        hardwareId: hardwareId || undefined,
        validitaGiorni: validita === "" ? undefined : Number(validita),
      }),
    }).catch(() => null);

    setInCorso(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Generazione non riuscita");
      return;
    }

    const blob = await r.blob();
    const nome = r.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "licenza.json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nome;
    a.click();
    URL.revokeObjectURL(url);

    setAperto(false);
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <button
          title="Genera file di licenza"
          className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text"
        >
          <Download size={13} />
        </button>
      </DialogTrigger>
      <DialogContent titolo="Genera file di licenza">
        <form onSubmit={genera} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <div className="flex items-start gap-2 rounded-md border border-border bg-surface2 px-3 py-2 text-xs text-muted">
              <AlertTriangle size={14} className="mt-0.5 flex-none" />
              <span>
                Il file generato è statico: sospendere o disdire questa licenza in Telaio non lo
                invalida automaticamente. Per revocare davvero una licenza offline, imposta
                scadenze brevi e fai rigenerare periodicamente il file al cliente.
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Seats" nota="Facoltativo">
                <Input value={seats} onChange={(e) => setSeats(e.target.value)} inputMode="numeric" className="text-right" />
              </Campo>
              <Campo etichetta="Validità (giorni)" nota="Vuoto = usa la scadenza della licenza">
                <Input value={validita} onChange={(e) => setValidita(e.target.value)} inputMode="numeric" className="text-right" />
              </Campo>
            </div>
            <Campo etichetta="Moduli abilitati" nota="Separati da virgola, facoltativo">
              <Input value={moduli} onChange={(e) => setModuli(e.target.value)} placeholder="fatturazione, magazzino" />
            </Campo>
            <Campo etichetta="Hardware ID" nota="Facoltativo: vincola la licenza a un dispositivo">
              <Input value={hardwareId} onChange={(e) => setHardwareId(e.target.value)} />
            </Campo>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
                {errore}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Genero…" : "Genera e scarica"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

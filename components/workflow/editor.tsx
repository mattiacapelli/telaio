"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Play, Trash2 } from "lucide-react";
import { CanvasWorkflow } from "@/components/workflow/canvas";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { EVENTI, FREQUENZE } from "@/lib/workflow/tipi";
import type { Blocco, Collegamento } from "@/lib/workflow/tipi";

export function EditorWorkflow({
  iniziale,
}: {
  iniziale: {
    id?: string;
    nome: string;
    descrizione: string;
    attivo: boolean;
    innesco: "EVENTO" | "PIANIFICATO" | "MANUALE";
    eventoChiave: string;
    blocchi: Blocco[];
    collegamenti: Collegamento[];
  };
}) {
  const router = useRouter();
  const [d, setD] = useState(iniziale);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [prova, setProva] = useState<string | null>(null);

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva() {
    setErrore(null);
    setSalvando(true);
    const corpo = {
      nome: d.nome,
      descrizione: d.descrizione || null,
      attivo: d.attivo,
      innesco: d.innesco,
      eventoChiave: d.eventoChiave || null,
      blocchi: d.blocchi,
      collegamenti: d.collegamenti,
    };
    const r = await fetch(d.id ? `/api/workflow/${d.id}` : "/api/workflow", {
      method: d.id ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);
    setSalvando(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    const creato = await r.json().catch(() => null);
    if (!d.id && creato?.id) router.push(`/workflow/${creato.id}`);
    else router.refresh();
  }

  async function eseguiProva() {
    if (!d.id) {
      setProva("Salva il workflow prima di provarlo.");
      return;
    }
    setProva("Eseguo…");
    const r = await fetch(`/api/workflow/${d.id}/esegui`, { method: "POST" }).catch(() => null);
    const x = await r?.json().catch(() => null);
    setProva(x?.esito ?? "Esecuzione non riuscita");
  }

  async function elimina() {
    if (!d.id || !confirm(`Eliminare «${d.nome}»?`)) return;
    await fetch(`/api/workflow/${d.id}`, { method: "DELETE" }).catch(() => null);
    router.push("/workflow");
  }

  return (
    <div className="tl-in flex h-[calc(100vh-108px)] flex-col gap-2">
      <div className="flex flex-wrap items-end gap-2">
        <Campo etichetta="Nome">
          <Input
            value={d.nome}
            onChange={(e) => set("nome", e.target.value)}
            className="w-56"
            placeholder="Es. Apri progetto da preventivo"
          />
        </Campo>
        <Campo etichetta="Innesco">
          <Select
            value={d.innesco}
            onChange={(e) => set("innesco", e.target.value as typeof d.innesco)}
          >
            <option value="EVENTO">Quando accade</option>
            <option value="PIANIFICATO">A intervalli</option>
            <option value="MANUALE">Su richiesta</option>
          </Select>
        </Campo>
        {d.innesco !== "MANUALE" && (
          <Campo etichetta={d.innesco === "EVENTO" ? "Evento" : "Frequenza"}>
            <Select
              value={d.eventoChiave}
              onChange={(e) => set("eventoChiave", e.target.value)}
              className="w-52"
            >
              <option value="">Scegli…</option>
              {(d.innesco === "EVENTO" ? EVENTI : FREQUENZE).map((o) => (
                <option key={o.valore} value={o.valore}>{o.etichetta}</option>
              ))}
            </Select>
          </Campo>
        )}
        <label className="flex h-[32px] items-center gap-1.5 text-md text-muted">
          <input
            type="checkbox"
            checked={d.attivo}
            onChange={(e) => set("attivo", e.target.checked)}
          />
          Attivo
        </label>

        <div className="flex-1" />
        {prova && <span className="text-xs text-muted">{prova}</span>}
        <Button size="sm" variant="outline" onClick={eseguiProva}>
          <Play /> Prova
        </Button>
        {d.id && (
          <Button size="sm" variant="ghost" onClick={elimina}>
            <Trash2 />
          </Button>
        )}
        <Button size="sm" onClick={salva} disabled={salvando || !d.nome}>
          {salvando ? "Salvo…" : "Salva"}
        </Button>
      </div>

      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
          {errore}
        </div>
      )}

      <div className="flex min-h-0 flex-1 overflow-hidden rounded border border-border">
        <CanvasWorkflow
          blocchi={d.blocchi}
          setBlocchi={(b) => set("blocchi", b)}
          collegamenti={d.collegamenti}
          setCollegamenti={(c) => set("collegamenti", c)}
        />
      </div>
    </div>
  );
}

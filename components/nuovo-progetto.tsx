"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NuovoProgetto({
  clienti,
}: {
  clienti: { id: string; ragioneSociale: string }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [d, setD] = useState({
    nome: "",
    clienteId: "",
    interno: false,
    valore: "",
    budgetOre: "",
    inizioIl: "",
    consegnaIl: "",
    note: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch("/api/progetti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: d.nome,
        clienteId: d.interno ? null : d.clienteId || null,
        valore: d.valore || 0,
        budgetOre: d.budgetOre || 0,
        inizioIl: d.inizioIl || null,
        consegnaIl: d.consegnaIl || null,
        note: d.note || null,
      }),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    const creato = await r.json().catch(() => null);
    setAperto(false);
    setD({ nome: "", clienteId: "", interno: false, valore: "", budgetOre: "", inizioIl: "", consegnaIl: "", note: "" });
    if (creato?.id) router.push(`/progetti/${creato.id}`);
    else router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuovo progetto</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo progetto" className="max-w-xl">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Nome">
              <Input
                value={d.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Es. Portale gestionale v2"
                required
                autoFocus
              />
            </Campo>

            <label className="flex items-center gap-1.5 text-md text-muted">
              <input
                type="checkbox"
                checked={d.interno}
                onChange={(e) => set("interno", e.target.checked)}
              />
              Progetto interno (R&D, prodotto proprio: non fatturato a un cliente)
            </label>

            {!d.interno && (
              <Campo etichetta="Cliente">
                <Select value={d.clienteId} onChange={(e) => set("clienteId", e.target.value)} required={!d.interno}>
                  <option value="">Scegli…</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.ragioneSociale}</option>
                  ))}
                </Select>
              </Campo>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Valore (EUR)" nota="Facoltativo">
                <Input
                  value={d.valore}
                  onChange={(e) => set("valore", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
              <Campo etichetta="Budget ore" nota="Facoltativo">
                <Input
                  value={d.budgetOre}
                  onChange={(e) => set("budgetOre", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Inizio" nota="Facoltativo">
                <Input type="date" value={d.inizioIl} onChange={(e) => set("inizioIl", e.target.value)} />
              </Campo>
              <Campo etichetta="Consegna prevista" nota="Facoltativa">
                <Input type="date" value={d.consegnaIl} onChange={(e) => set("consegnaIl", e.target.value)} />
              </Campo>
            </div>

            <Campo etichetta="Note" nota="Facoltative">
              <Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />
            </Campo>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvo…" : "Crea progetto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

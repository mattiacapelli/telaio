"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NuovoProdotto({
  progetti,
}: {
  progetti: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [d, setD] = useState({
    nome: "",
    descrizione: "",
    prezzoListino: "",
    progettoId: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch("/api/prodotti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: d.nome,
        descrizione: d.descrizione || null,
        prezzoListino: d.prezzoListino === "" ? null : d.prezzoListino,
        progettoId: d.progettoId || null,
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
    setD({ nome: "", descrizione: "", prezzoListino: "", progettoId: "" });
    if (creato?.id) router.push(`/prodotti/${creato.id}`);
    else router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuovo prodotto</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo prodotto" className="max-w-lg">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Nome">
              <Input
                value={d.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Es. Gestionale Ferrero"
                required
                autoFocus
              />
            </Campo>

            <Campo etichetta="Descrizione" nota="Facoltativa">
              <Textarea rows={2} value={d.descrizione} onChange={(e) => set("descrizione", e.target.value)} />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Prezzo listino (EUR)" nota="Facoltativo">
                <Input
                  value={d.prezzoListino}
                  onChange={(e) => set("prezzoListino", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
              <Campo etichetta="Progetto collegato" nota="Facoltativo">
                <Select value={d.progettoId} onChange={(e) => set("progettoId", e.target.value)}>
                  <option value="">Nessuno</option>
                  {progetti.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Select>
              </Campo>
            </div>

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
              {salvando ? "Salvo…" : "Crea prodotto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NuovoPiano({ prodottoId }: { prodottoId: string }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [d, setD] = useState({
    nome: "",
    descrizione: "",
    canone: "",
    periodicita: "MENSILE",
    terminiPagamento: "30",
    monteOre: "",
    tariffaExtra: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch(`/api/prodotti/${prodottoId}/piani`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: d.nome,
        descrizione: d.descrizione || null,
        canone: d.canone || 0,
        periodicita: d.periodicita,
        terminiPagamento: d.terminiPagamento || 30,
        monteOre: d.monteOre === "" ? null : d.monteOre,
        tariffaExtra: d.tariffaExtra === "" ? null : d.tariffaExtra,
      }),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setD({ nome: "", descrizione: "", canone: "", periodicita: "MENSILE", terminiPagamento: "30", monteOre: "", tariffaExtra: "" });
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuovo piano</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo piano" className="max-w-lg">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Nome">
              <Input
                value={d.nome}
                onChange={(e) => set("nome", e.target.value)}
                placeholder="Es. Base, Pro, Enterprise"
                required
                autoFocus
              />
            </Campo>

            <Campo etichetta="Descrizione" nota="Facoltativa">
              <Textarea rows={2} value={d.descrizione} onChange={(e) => set("descrizione", e.target.value)} />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Canone (EUR)">
                <Input
                  value={d.canone}
                  onChange={(e) => set("canone", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  required
                />
              </Campo>
              <Campo etichetta="Periodicità">
                <Select value={d.periodicita} onChange={(e) => set("periodicita", e.target.value)}>
                  <option value="MENSILE">Mensile</option>
                  <option value="TRIMESTRALE">Trimestrale</option>
                  <option value="SEMESTRALE">Semestrale</option>
                  <option value="ANNUALE">Annuale</option>
                </Select>
              </Campo>
            </div>

            <Campo etichetta="Termini di pagamento (giorni)" nota="Giorni dalla fattura alla scadenza">
              <Input
                value={d.terminiPagamento}
                onChange={(e) => set("terminiPagamento", e.target.value)}
                inputMode="numeric"
                className="text-right"
              />
            </Campo>

            <div className="grid gap-3 rounded border border-border bg-surface2 p-2 sm:grid-cols-2">
              <Campo etichetta="Monte ore incluso" nota="Facoltativo">
                <Input
                  value={d.monteOre}
                  onChange={(e) => set("monteOre", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  placeholder="Nessuna"
                />
              </Campo>
              <Campo etichetta="Tariffa ore extra" nota="Facoltativa">
                <Input
                  value={d.tariffaExtra}
                  onChange={(e) => set("tariffaExtra", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                />
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
              {salvando ? "Salvo…" : "Crea piano"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

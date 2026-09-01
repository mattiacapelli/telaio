"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";

function useAzione() {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function esegui(url: string, opzioni: RequestInit) {
    setErrore(null);
    setInCorso(true);
    const r = await fetch(url, opzioni).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Operazione non riuscita");
      return false;
    }
    router.refresh();
    return true;
  }

  return { esegui, inCorso, errore };
}

export function NuovaAttivita({
  progetti,
}: {
  progetti: { id: string; nome: string }[];
}) {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [progettoId, setProgettoId] = useState("");
  const [stimaOre, setStimaOre] = useState("");
  const [scadenzaIl, setScadenza] = useState("");
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui("/api/attivita", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo,
        progettoId: progettoId || null,
        stimaOre: stimaOre === "" ? null : stimaOre,
        scadenzaIl: scadenzaIl || null,
      }),
    });
    if (ok) {
      setAperto(false);
      setTitolo("");
      setProgettoId("");
      setStimaOre("");
      setScadenza("");
    }
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuova attività</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuova attività">
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Titolo">
              <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} required autoFocus />
            </Campo>
            <Campo etichetta="Progetto" nota="Facoltativo: vuoto per un'attività libera">
              <Select value={progettoId} onChange={(e) => setProgettoId(e.target.value)}>
                <option value="">Nessuno</option>
                {progetti.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Stima ore">
                <Input value={stimaOre} onChange={(e) => setStimaOre(e.target.value)} inputMode="decimal" className="text-right" />
              </Campo>
              <Campo etichetta="Scadenza">
                <Input type="date" value={scadenzaIl} onChange={(e) => setScadenza(e.target.value)} />
              </Campo>
            </div>
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
              {inCorso ? "Salvo…" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

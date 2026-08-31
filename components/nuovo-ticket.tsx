"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NuovoTicket({
  clienti,
  progetti,
}: {
  clienti: { id: string; ragioneSociale: string }[];
  progetti: { id: string; nome: string; clienteId: string | null }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const [d, setD] = useState({
    clienteId: "",
    titolo: "",
    descrizione: "",
    progettoId: "",
    priorita: "MEDIA",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  const progettiCliente = progetti.filter((p) => p.clienteId === d.clienteId);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch("/api/ticket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: d.clienteId,
        titolo: d.titolo,
        descrizione: d.descrizione || null,
        progettoId: d.progettoId || null,
        priorita: d.priorita,
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
    setD({ clienteId: "", titolo: "", descrizione: "", progettoId: "", priorita: "MEDIA" });
    if (creato?.id) router.push(`/ticket/${creato.id}`);
    else router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuovo ticket</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Nuovo ticket"
        descrizione="Il numero viene assegnato al salvataggio."
        className="max-w-xl"
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Cliente">
                <Select
                  value={d.clienteId}
                  onChange={(e) => setD({ ...d, clienteId: e.target.value, progettoId: "" })}
                  required
                >
                  <option value="">Scegli…</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.ragioneSociale}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Priorità">
                <Select value={d.priorita} onChange={(e) => set("priorita", e.target.value)}>
                  <option value="BASSA">Bassa</option>
                  <option value="MEDIA">Media</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </Select>
              </Campo>
            </div>

            <Campo etichetta="Titolo">
              <Input
                value={d.titolo}
                onChange={(e) => set("titolo", e.target.value)}
                placeholder="Es. Errore in fase di login"
                required
                autoFocus
              />
            </Campo>

            <Campo etichetta="Progetto collegato" nota="Facoltativo">
              <Select
                value={d.progettoId}
                onChange={(e) => set("progettoId", e.target.value)}
                disabled={!d.clienteId}
              >
                <option value="">Nessuno</option>
                {progettiCliente.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </Select>
            </Campo>

            <Campo etichetta="Descrizione" nota="Facoltativa">
              <Textarea rows={3} value={d.descrizione} onChange={(e) => set("descrizione", e.target.value)} />
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
              {salvando ? "Salvo…" : "Crea ticket"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function NuovaLicenza({
  prodottoId,
  clienti,
  contratti,
  piani = [],
}: {
  prodottoId: string;
  clienti: { id: string; ragioneSociale: string }[];
  contratti: { id: string; numero: string; clienteId: string }[];
  piani?: { id: string; nome: string; canone: number }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    clienteId: "",
    contrattoId: "",
    pianoId: "",
    attivataIl: oggi,
    scadeIl: "",
    canone: "",
    note: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  const contrattiCliente = contratti.filter((c) => c.clienteId === d.clienteId);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch(`/api/prodotti/${prodottoId}/licenze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId: d.clienteId,
        contrattoId: d.contrattoId || null,
        pianoId: d.pianoId || null,
        attivataIl: d.attivataIl,
        scadeIl: d.scadeIl || null,
        canone: d.canone === "" ? null : d.canone,
        note: d.note || null,
      }),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setD({ clienteId: "", contrattoId: "", pianoId: "", attivataIl: oggi, scadeIl: "", canone: "", note: "" });
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuova licenza</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuova licenza" className="max-w-lg">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Cliente">
              <Select
                value={d.clienteId}
                onChange={(e) => setD({ ...d, clienteId: e.target.value, contrattoId: "" })}
                required
                autoFocus
              >
                <option value="">Scegli…</option>
                {clienti.map((c) => (
                  <option key={c.id} value={c.id}>{c.ragioneSociale}</option>
                ))}
              </Select>
            </Campo>

            <Campo etichetta="Contratto collegato" nota="Facoltativo: per il rinnovo del canone">
              <Select
                value={d.contrattoId}
                onChange={(e) => set("contrattoId", e.target.value)}
                disabled={!d.clienteId}
              >
                <option value="">Nessuno</option>
                {contrattiCliente.map((c) => (
                  <option key={c.id} value={c.id}>{c.numero}</option>
                ))}
              </Select>
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Attivata il">
                <Input type="date" value={d.attivataIl} onChange={(e) => set("attivataIl", e.target.value)} required />
              </Campo>
              <Campo etichetta="Scadenza" nota="Vuoto = senza scadenza">
                <Input type="date" value={d.scadeIl} onChange={(e) => set("scadeIl", e.target.value)} />
              </Campo>
            </div>

            {piani.length > 0 && (
              <Campo etichetta="Piano" nota="Facoltativo: fissa canone e termini della licenza">
                <Select value={d.pianoId} onChange={(e) => set("pianoId", e.target.value)}>
                  <option value="">Nessuno (canone libero)</option>
                  {piani.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome} · {p.canone.toLocaleString("it-IT", { style: "currency", currency: "EUR" })}
                    </option>
                  ))}
                </Select>
              </Campo>
            )}

            {!d.pianoId && (
              <Campo etichetta="Canone (EUR)" nota="Facoltativo: vuoto se incluso nel contratto">
                <Input
                  value={d.canone}
                  onChange={(e) => set("canone", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
            )}

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
              {salvando ? "Salvo…" : "Crea licenza"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

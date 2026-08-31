"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { eur } from "@/lib/format";

type FatturaAperta = {
  id: string;
  numero: string;
  cliente: string;
  residuo: number;
};

type ContoOpzione = { id: string; nome: string; predefinito: boolean };

/** Registra un pagamento ricevuto su una fattura emessa. */
export function RegistraIncasso({
  fatture,
  conti = [],
}: {
  fatture: FatturaAperta[];
  conti?: ContoOpzione[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    fatturaId: "",
    data: oggi,
    importo: "",
    metodo: "BONIFICO",
    contoId: conti.find((c) => c.predefinito)?.id ?? "",
    nota: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });
  const scelta = fatture.find((f) => f.id === d.fatturaId);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/incassi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...d, contoId: d.contoId || null, nota: d.nota || null }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setAperto(false);
    setD({ ...d, fatturaId: "", importo: "", nota: "" });
    router.refresh();
  }

  if (fatture.length === 0) {
    return (
      <Button size="sm" disabled title="Nessuna fattura da incassare">
        <Plus /> Registra incasso
      </Button>
    );
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Registra incasso</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Registra un incasso"
        descrizione="Quando il totale copre l'imponibile la fattura passa a pagata."
      >
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Fattura">
              <Select
                value={d.fatturaId}
                onChange={(e) => {
                  const f = fatture.find((x) => x.id === e.target.value);
                  // Preimposta il residuo: il caso normale è il saldo pieno.
                  setD({
                    ...d,
                    fatturaId: e.target.value,
                    importo: f ? String(f.residuo) : "",
                  });
                }}
                required
                autoFocus
              >
                <option value="">Scegli…</option>
                {fatture.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.numero} · {f.cliente} · residuo {eur(f.residuo)}
                  </option>
                ))}
              </Select>
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Data">
                <Input type="date" value={d.data} onChange={(e) => set("data", e.target.value)} required />
              </Campo>
              <Campo
                etichetta="Importo (EUR)"
                nota={scelta ? `residuo ${eur(scelta.residuo)}` : undefined}
              >
                <Input
                  value={d.importo}
                  onChange={(e) => set("importo", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  required
                />
              </Campo>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Metodo">
                <Select value={d.metodo} onChange={(e) => set("metodo", e.target.value)}>
                  <option value="BONIFICO">Bonifico</option>
                  <option value="CARTA">Carta</option>
                  <option value="CONTANTI">Contanti</option>
                  <option value="ALTRO">Altro</option>
                </Select>
              </Campo>
              <Campo etichetta="Conto" nota={conti.length === 0 ? "Configurabile in Impostazioni" : "Facoltativo"}>
                <Select value={d.contoId} onChange={(e) => set("contoId", e.target.value)} disabled={conti.length === 0}>
                  <option value="">Non specificato</option>
                  {conti.map((c) => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </Select>
              </Campo>
            </div>

            <Campo etichetta="Nota" nota="Facoltativa">
              <Input
                value={d.nota}
                onChange={(e) => set("nota", e.target.value)}
                placeholder="Es. acconto 50%"
              />
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
              {inCorso ? "Salvo…" : "Registra"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Annulla un pagamento registrato per errore. */
export function EliminaIncasso({ id }: { id: string }) {
  const router = useRouter();
  const [inCorso, setInCorso] = useState(false);

  return (
    <button
      onClick={async () => {
        if (!confirm("Annullare questo incasso?")) return;
        setInCorso(true);
        await fetch(`/api/incassi/${id}`, { method: "DELETE" }).catch(() => null);
        setInCorso(false);
        router.refresh();
      }}
      disabled={inCorso}
      title="Annulla incasso"
      className="grid h-5 w-5 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
    >
      <Trash2 size={11} />
    </button>
  );
}

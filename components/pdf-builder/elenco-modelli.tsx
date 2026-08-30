"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Star, Trash2, FileText } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";

type Modello = {
  id: string;
  nome: string;
  ambito: string;
  descrizione: string | null;
  predefinito: boolean;
};

/** Elenco dei modelli PDF, da cui si aprono o si creano. */
export function ElencoModelli({ modelli }: { modelli: Modello[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  const gruppi = {
    PREVENTIVO: modelli.filter((m) => m.ambito === "PREVENTIVO"),
    CONTRATTO: modelli.filter((m) => m.ambito === "CONTRATTO"),
  };

  async function rendiPredefinito(id: string) {
    await fetch(`/api/modelli-pdf/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predefinito: true }),
    }).catch(() => null);
    router.refresh();
  }

  async function elimina(id: string, nome: string) {
    if (!confirm(`Eliminare «${nome}»?`)) return;
    const r = await fetch(`/api/modelli-pdf/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Eliminazione non riuscita");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
          {errore}
        </div>
      )}

      {(["PREVENTIVO", "CONTRATTO"] as const).map((ambito) => (
        <div key={ambito}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-xs font-medium">
              {ambito === "PREVENTIVO" ? "Modelli preventivi" : "Modelli contratti"}
            </span>
            <div className="flex-1" />
            <NuovoModello ambito={ambito} />
          </div>

          <div className="rounded-md border border-border">
            {gruppi[ambito].length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-faint">
                Nessun modello: viene usato quello di base incorporato.
              </div>
            ) : (
              gruppi[ambito].map((m) => (
                <div
                  key={m.id}
                  className="group flex items-center gap-2 border-b border-border px-3 py-2 last:border-0"
                >
                  <FileText size={13} className="flex-none text-faint" />
                  <Link href={`/modelli-pdf/${m.id}`} className="min-w-0 flex-1 hover:underline">
                    <div className="truncate text-xs font-medium">{m.nome}</div>
                    {m.descrizione && (
                      <div className="truncate text-xs text-faint">{m.descrizione}</div>
                    )}
                  </Link>
                  {m.predefinito ? (
                    <span className="flex flex-none items-center gap-1 text-xs text-accent">
                      <Star size={11} /> predefinito
                    </span>
                  ) : (
                    <button
                      onClick={() => rendiPredefinito(m.id)}
                      className="flex-none text-xs text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                    >
                      rendi predefinito
                    </button>
                  )}
                  <button
                    onClick={() => elimina(m.id, m.nome)}
                    title="Elimina"
                    className="grid h-6 w-6 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function NuovoModello({ ambito }: { ambito: "PREVENTIVO" | "CONTRATTO" }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/modelli-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, ambito }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    const creato = await r.json().catch(() => null);
    setAperto(false);
    if (creato?.id) router.push(`/modelli-pdf/${creato.id}`);
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuovo modello</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Nuovo modello"
        descrizione="Parte dai blocchi di base: potrai riordinarli e configurarli nel builder."
      >
        <form onSubmit={crea} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Nome">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} required autoFocus />
            </Campo>
            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={inCorso || !nome.trim()}>
              {inCorso ? "Creo…" : "Crea e apri"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

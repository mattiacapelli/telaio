"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";
import type { Entita } from "@/lib/eliminazione";

/** Riga del cestino: ripristina o elimina per sempre, con conferma testuale. */
export function RigaCestino({
  entita,
  id,
  nome,
  dettaglio,
}: {
  entita: Entita;
  id: string;
  nome: string;
  dettaglio?: string;
}) {
  const router = useRouter();
  const [ripristinando, setRipristinando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function ripristina() {
    setErrore(null);
    setRipristinando(true);
    const r = await fetch(`/api/cestino/${entita}/${id}/ripristina`, { method: "POST" }).catch(() => null);
    setRipristinando(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Ripristino non riuscito");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 py-2.5 last:border-0">
      <div className="min-w-0 flex-1">
        <div className="truncate text-md font-medium">{nome}</div>
        {dettaglio && <div className="truncate text-xs text-faint">{dettaglio}</div>}
        {errore && <div className="text-xs text-neg">{errore}</div>}
      </div>
      <Button variant="outline" size="sm" onClick={ripristina} disabled={ripristinando}>
        {ripristinando ? <Loader2 className="animate-spin" /> : <RotateCcw />}
        Ripristina
      </Button>
      <EliminaDefinitivamente entita={entita} id={id} nome={nome} />
    </div>
  );
}

/**
 * Elimina per sempre, con la stessa frizione di GitHub: bisogna ridigitare
 * il nome esatto del record. Un'azione irreversibile non deve essere a un
 * solo click di distanza da uno sguardo distratto.
 */
function EliminaDefinitivamente({ entita, id, nome }: { entita: Entita; id: string; nome: string }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [conferma, setConferma] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function elimina(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch(`/api/cestino/${entita}/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conferma }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Eliminazione non riuscita");
      return;
    }
    setAperto(false);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={(v) => { setAperto(v); if (!v) { setConferma(""); setErrore(null); } }}>
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          <Trash2 /> Elimina per sempre
        </Button>
      </DialogTrigger>
      <DialogContent
        titolo="Eliminare per sempre?"
        descrizione="Non si può annullare: il record e i suoi dati collegati non saranno più recuperabili."
      >
        <form onSubmit={elimina} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta={`Scrivi «${nome}» per confermare`}>
              <Input
                value={conferma}
                onChange={(e) => setConferma(e.target.value)}
                autoFocus
                autoComplete="off"
              />
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
            <Button type="submit" variant="danger" size="sm" disabled={inCorso || conferma.trim() !== nome.trim()}>
              {inCorso ? "Elimino…" : "Elimina per sempre"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

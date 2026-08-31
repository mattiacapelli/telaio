"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Wallet } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";
import { EliminaRecord } from "@/components/elimina-record";

export type ContoIncasso = {
  id: string;
  nome: string;
  note: string | null;
  predefinito: boolean;
};

/**
 * Elenco dei conti su cui arrivano gli incassi (banca, PayPal, cassa...).
 *
 * Prima era un campo di testo libero su ogni incasso: qui si sceglie da un
 * menu, così lo stesso conto non finisce spaccato in due nei riepiloghi per
 * una battitura diversa.
 */
export function ElencoContiIncasso({ conti }: { conti: ContoIncasso[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  async function rendiPredefinito(id: string) {
    await fetch(`/api/conti-incasso/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ predefinito: true }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
          {errore}
        </div>
      )}

      <div className="rounded-md border border-border">
        {conti.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-faint">
            Nessun conto configurato: gli incassi restano "non specificati".
          </div>
        ) : (
          conti.map((c) => (
            <div key={c.id} className="group flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
              <Wallet size={13} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{c.nome}</div>
                {c.note && <div className="truncate text-xs text-faint">{c.note}</div>}
              </div>
              {c.predefinito ? (
                <span className="flex flex-none items-center gap-1 text-xs text-accent">
                  <Star size={11} /> predefinito
                </span>
              ) : (
                <button
                  onClick={() => rendiPredefinito(c.id)}
                  className="flex-none text-xs text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                >
                  rendi predefinito
                </button>
              )}
              <EliminaRecord entita="contoIncasso" id={c.id} nome={c.nome} size="sm" variant="ghost" />
            </div>
          ))
        )}
      </div>

      <div className="flex">
        <div className="flex-1" />
        <NuovoConto />
      </div>
    </div>
  );
}

function NuovoConto() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [note, setNote] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/conti-incasso", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, note: note || null }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    setAperto(false);
    setNome("");
    setNote("");
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuovo conto</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo conto">
        <form onSubmit={crea} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Nome">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Banca Sella"
                required
                autoFocus
              />
            </Campo>
            <Campo etichetta="Note" nota="Facoltative">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Es. IBAN o conto principale" />
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
              {inCorso ? "Creo…" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

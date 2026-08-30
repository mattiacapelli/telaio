"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";

type Opzione = { id: string; etichetta: string; gruppo?: string };

/**
 * Inserimento e modifica manuale delle ore.
 *
 * Serve per il lavoro svolto senza timer: senza, l'unico modo di registrare
 * il tempo sarebbe ricordarsi di avviare il cronometro.
 */
export function InserisciOre({
  progetti,
  attivita,
  ticket,
  registrazione,
  dataIniziale,
  compatto,
}: {
  progetti: Opzione[];
  attivita: Opzione[];
  ticket: Opzione[];
  registrazione?: {
    id: string;
    data: string;
    ore: number;
    descrizione: string;
    fatturabile: boolean;
  };
  dataIniziale?: string;
  compatto?: boolean;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    data: registrazione?.data ?? dataIniziale ?? oggi,
    ore: registrazione ? String(registrazione.ore) : "",
    descrizione: registrazione?.descrizione ?? "",
    fatturabile: registrazione?.fatturabile ?? true,
    // In modifica il collegamento non si cambia: sposterebbe le ore da un
    // progetto all'altro falsando entrambi i consuntivi.
    riferimento: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);

    const corpo: Record<string, unknown> = {
      data: d.data,
      ore: d.ore,
      descrizione: d.descrizione || null,
      fatturabile: d.fatturabile,
    };

    if (!registrazione) {
      const [tipo, id] = d.riferimento.split(":");
      if (!id) {
        setInCorso(false);
        setErrore("Scegli un progetto, un'attività o un ticket");
        return;
      }
      if (tipo === "p") corpo.progettoId = id;
      if (tipo === "a") corpo.attivitaId = id;
      if (tipo === "t") corpo.ticketId = id;
    }

    const r = await fetch(registrazione ? `/api/ore/${registrazione.id}` : "/api/ore", {
      method: registrazione ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpo),
    }).catch(() => null);

    setInCorso(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    if (!registrazione) setD({ ...d, ore: "", descrizione: "", riferimento: "" });
    router.refresh();
  }

  async function elimina() {
    if (!registrazione || !confirm("Eliminare questa registrazione?")) return;
    const r = await fetch(`/api/ore/${registrazione.id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Eliminazione non riuscita");
      return;
    }
    setAperto(false);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        {registrazione ? (
          <button
            title="Modifica ore"
            className="grid h-5 w-5 place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text"
          >
            <Pencil size={11} />
          </button>
        ) : compatto ? (
          <button
            title="Aggiungi ore"
            className="grid h-full w-full place-items-center text-faint transition-colors hover:bg-[var(--alpha-light)] hover:text-accent"
          >
            +
          </button>
        ) : (
          <Button size="sm"><Plus /> Inserisci ore</Button>
        )}
      </DialogTrigger>

      <DialogContent titolo={registrazione ? "Modifica ore" : "Inserisci ore"}>
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Data">
                <Input type="date" value={d.data} onChange={(e) => set("data", e.target.value)} required />
              </Campo>
              <Campo etichetta="Ore">
                <Input
                  value={d.ore}
                  onChange={(e) => set("ore", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  placeholder="2,5"
                  required
                  autoFocus
                />
              </Campo>
            </div>

            {!registrazione && (
              <Campo etichetta="Su cosa" nota="Progetto, attività o ticket">
                <Select
                  value={d.riferimento}
                  onChange={(e) => set("riferimento", e.target.value)}
                  required
                >
                  <option value="">Scegli…</option>
                  {attivita.length > 0 && (
                    <optgroup label="Attività">
                      {attivita.map((a) => (
                        <option key={a.id} value={`a:${a.id}`}>{a.etichetta}</option>
                      ))}
                    </optgroup>
                  )}
                  {ticket.length > 0 && (
                    <optgroup label="Ticket">
                      {ticket.map((t) => (
                        <option key={t.id} value={`t:${t.id}`}>{t.etichetta}</option>
                      ))}
                    </optgroup>
                  )}
                  {progetti.length > 0 && (
                    <optgroup label="Progetti">
                      {progetti.map((p) => (
                        <option key={p.id} value={`p:${p.id}`}>{p.etichetta}</option>
                      ))}
                    </optgroup>
                  )}
                </Select>
              </Campo>
            )}

            <Campo etichetta="Descrizione" nota="Facoltativa">
              <Input
                value={d.descrizione}
                onChange={(e) => set("descrizione", e.target.value)}
                placeholder="Es. analisi requisiti con il cliente"
              />
            </Campo>

            <label className="flex items-center gap-1.5 text-md text-muted">
              <input
                type="checkbox"
                checked={d.fatturabile}
                onChange={(e) => set("fatturabile", e.target.checked)}
              />
              Ore fatturabili
            </label>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            {registrazione && (
              <Button type="button" variant="ghost" size="sm" onClick={elimina}>
                <Trash2 />
              </Button>
            )}
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

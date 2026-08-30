"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Car, Package, KeyRound, Users, Receipt } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { eur } from "@/lib/format";

export const TIPI_COSTO: Record<string, { etichetta: string; icona: typeof Car }> = {
  TRASFERTA: { etichetta: "Trasferta", icona: Car },
  MATERIALE: { etichetta: "Materiale", icona: Package },
  LICENZA: { etichetta: "Licenza", icona: KeyRound },
  SERVIZIO_TERZI: { etichetta: "Servizio di terzi", icona: Users },
  ALTRO: { etichetta: "Altro", icona: Receipt },
};

/**
 * Registra un costo su un ticket, un'attività o un progetto.
 *
 * Le trasferte hanno tre modalità: a chilometri (quantità × tariffa), a piè
 * di lista (spesa effettiva) o forfettaria. La modalità e le tariffe
 * predefinite vengono dalle impostazioni.
 */
export function RegistraCosto({
  ticketId,
  progettoId,
  attivitaId,
  predefiniti,
}: {
  ticketId?: string;
  progettoId?: string;
  attivitaId?: string;
  predefiniti: {
    modalita: string;
    tariffaChilometrica: number;
    forfait: number;
  };
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  const oggi = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    data: oggi,
    tipo: "TRASFERTA",
    descrizione: "",
    importo: "",
    quantita: "",
    tariffa: String(predefiniti.tariffaChilometrica),
    modalita: predefiniti.modalita,
    rimborsabile: true,
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  const trasferta = d.tipo === "TRASFERTA";
  const chilometrica = trasferta && d.modalita === "CHILOMETRICA";
  // Anteprima del totale: per i chilometri si calcola, altrimenti è l'importo.
  const totale = chilometrica
    ? (Number(d.quantita) || 0) * (Number(d.tariffa) || 0)
    : Number(d.importo) || 0;

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);

    const r = await fetch("/api/costi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        data: d.data,
        tipo: d.tipo,
        descrizione: d.descrizione,
        importo: chilometrica ? undefined : d.importo,
        quantita: chilometrica ? d.quantita : null,
        tariffa: chilometrica ? d.tariffa : null,
        modalita: trasferta ? d.modalita : null,
        rimborsabile: d.rimborsabile,
        ticketId: ticketId ?? null,
        progettoId: progettoId ?? null,
        attivitaId: attivitaId ?? null,
      }),
    }).catch(() => null);

    setInCorso(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setD({ ...d, descrizione: "", importo: "", quantita: "" });
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Costo</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Registra un costo"
        descrizione="Trasferte, materiali e spese sostenute per questo lavoro."
      >
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Tipo">
                <Select value={d.tipo} onChange={(e) => set("tipo", e.target.value)}>
                  {Object.entries(TIPI_COSTO).map(([k, v]) => (
                    <option key={k} value={k}>{v.etichetta}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Data">
                <Input type="date" value={d.data} onChange={(e) => set("data", e.target.value)} required />
              </Campo>
            </div>

            <Campo etichetta="Descrizione">
              <Input
                value={d.descrizione}
                onChange={(e) => set("descrizione", e.target.value)}
                placeholder={trasferta ? "Es. sopralluogo sede cliente" : "Es. licenza annuale"}
                required
                autoFocus
              />
            </Campo>

            {trasferta && (
              <Campo etichetta="Come si calcola">
                <Select value={d.modalita} onChange={(e) => set("modalita", e.target.value)}>
                  <option value="CHILOMETRICA">A chilometri</option>
                  <option value="PIE_DI_LISTA">A piè di lista (spesa effettiva)</option>
                  <option value="FORFETTARIA">Forfettaria</option>
                </Select>
              </Campo>
            )}

            {chilometrica ? (
              <div className="grid gap-3 rounded border border-border bg-surface2 p-2 sm:grid-cols-2">
                <Campo etichetta="Chilometri">
                  <Input
                    value={d.quantita}
                    onChange={(e) => set("quantita", e.target.value)}
                    inputMode="decimal"
                    className="text-right"
                    placeholder="45"
                    required
                  />
                </Campo>
                <Campo etichetta="Tariffa al km">
                  <Input
                    value={d.tariffa}
                    onChange={(e) => set("tariffa", e.target.value)}
                    inputMode="decimal"
                    className="text-right"
                  />
                </Campo>
              </div>
            ) : (
              <Campo
                etichetta="Importo (EUR)"
                nota={
                  trasferta && d.modalita === "FORFETTARIA"
                    ? `forfait predefinito: ${eur(predefiniti.forfait)}`
                    : undefined
                }
              >
                <Input
                  value={d.importo}
                  onChange={(e) => set("importo", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  placeholder={
                    trasferta && d.modalita === "FORFETTARIA"
                      ? String(predefiniti.forfait)
                      : "0,00"
                  }
                  required
                />
              </Campo>
            )}

            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={d.rimborsabile}
                onChange={(e) => set("rimborsabile", e.target.checked)}
              />
              Rimborsabile al cliente
            </label>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t border-border px-4 py-3">
            <span className="text-xs text-muted">
              Totale <strong className="text-text">{eur(totale)}</strong>
            </span>
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

/** Elimina un costo non ancora fatturato. */
export function EliminaCosto({ id }: { id: string }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  return (
    <button
      onClick={async () => {
        if (!confirm("Eliminare questo costo?")) return;
        const r = await fetch(`/api/costi/${id}`, { method: "DELETE" }).catch(() => null);
        if (!r || !r.ok) {
          const x = await r?.json().catch(() => null);
          setErrore(x?.errore ?? "Eliminazione non riuscita");
          return;
        }
        router.refresh();
      }}
      title={errore ?? "Elimina"}
      className="grid h-5 w-5 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
    >
      <Trash2 size={11} />
    </button>
  );
}

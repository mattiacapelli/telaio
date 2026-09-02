"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { eur, ore } from "@/lib/format";

type Riga = { descrizione: string; quantita: string; prezzo: string };
type Proposta = {
  clienteId: string;
  cliente: string;
  ore: number;
  importo: number;
};

/** Genera una fattura dalle ore non ancora fatturate. */
export function GeneraDaOre() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [proposte, setProposte] = useState<Proposta[] | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);

  useEffect(() => {
    if (!aperto) return;
    setProposte(null);
    setErrore(null);
    fetch("/api/fatture/da-ore")
      .then((r) => r.json())
      .then((d) => setProposte(d.proposte ?? []))
      .catch(() => setErrore("Impossibile caricare le ore da fatturare"));
  }, [aperto]);

  async function genera(clienteId: string) {
    setInCorso(clienteId);
    setErrore(null);
    const r = await fetch("/api/fatture/da-ore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clienteId }),
    }).catch(() => null);
    setInCorso(null);

    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Generazione non riuscita");
      return;
    }
    setAperto(false);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Wand2 /> Genera da ore
        </Button>
      </DialogTrigger>

      <DialogContent
        titolo="Genera fattura dalle ore"
        descrizione="Ore fatturabili non ancora inserite in una fattura, raggruppate per cliente."
      >
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3">
          {errore && (
            <div className="mb-2 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-md text-neg">
              {errore}
            </div>
          )}

          {proposte === null ? (
            <div className="py-8 text-center text-md text-faint">Carico…</div>
          ) : proposte.length === 0 ? (
            <div className="py-8 text-center text-md text-faint">
              Nessuna ora da fatturare.
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {proposte.map((p) => (
                <div
                  key={p.clienteId}
                  className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-md font-medium">{p.cliente}</div>
                    <div className="text-xs text-faint">
                      {ore(p.ore)} da fatturare
                    </div>
                  </div>
                  <span className="text-md font-semibold">{eur(p.importo)}</span>
                  <Button
                    size="sm"
                    onClick={() => genera(p.clienteId)}
                    disabled={inCorso !== null}
                  >
                    {inCorso === p.clienteId ? "Genero…" : "Genera"}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Fattura compilata a mano. */
export function NuovaFattura({
  clienti,
  aziende = [],
}: {
  clienti: { id: string; ragioneSociale: string; tariffaOraria: number }[];
  aziende?: { id: string; ragioneSociale: string }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [clienteId, setClienteId] = useState("");
  const [aziendaId, setAziendaId] = useState("");
  const [scadeIl, setScadeIl] = useState("");
  const [righe, setRighe] = useState<Riga[]>([
    { descrizione: "", quantita: "1", prezzo: "" },
  ]);

  const totale = righe.reduce(
    (s, r) => s + (Number(r.quantita) || 0) * (Number(r.prezzo) || 0),
    0,
  );

  function aggiorna(i: number, campo: keyof Riga, valore: string) {
    setRighe((v) => v.map((x, j) => (j === i ? { ...x, [campo]: valore } : x)));
  }

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch("/api/fatture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        aziendaId: aziendaId || null,
        scadeIl: scadeIl || null,
        righe: righe
          .filter((x) => x.descrizione.trim())
          .map((x) => ({
            descrizione: x.descrizione,
            quantita: x.quantita || 0,
            prezzo: x.prezzo || 0,
          })),
      }),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setClienteId("");
    setAziendaId("");
    setScadeIl("");
    setRighe([{ descrizione: "", quantita: "1", prezzo: "" }]);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nuova fattura
        </Button>
      </DialogTrigger>

      <DialogContent
        titolo="Nuova fattura"
        descrizione="Numero assegnato al salvataggio. Scadenza dai termini del cliente, se non indicata."
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Cliente">
                <Select
                  value={clienteId}
                  onChange={(e) => {
                    setClienteId(e.target.value);
                    const t = clienti.find((c) => c.id === e.target.value)?.tariffaOraria;
                    if (t) {
                      setRighe((v) =>
                        v.map((x) => (x.prezzo === "" ? { ...x, prezzo: String(t) } : x)),
                      );
                    }
                  }}
                  required
                >
                  <option value="">Scegli…</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.ragioneSociale}
                    </option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Scadenza" nota="Facoltativa">
                <Input
                  type="date"
                  value={scadeIl}
                  onChange={(e) => setScadeIl(e.target.value)}
                />
              </Campo>
              {aziende.length > 1 && (
                <Campo etichetta="Ragione sociale emittente" nota="Vuoto = quella predefinita">
                  <Select value={aziendaId} onChange={(e) => setAziendaId(e.target.value)}>
                    <option value="">Predefinita</option>
                    {aziende.map((a) => (
                      <option key={a.id} value={a.id}>{a.ragioneSociale}</option>
                    ))}
                  </Select>
                </Campo>
              )}
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="text-md font-medium">Righe</span>
                <div className="flex-1" />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setRighe((v) => [...v, { descrizione: "", quantita: "1", prezzo: "" }])
                  }
                >
                  <Plus /> Aggiungi
                </Button>
              </div>

              <div className="flex flex-col gap-1.5">
                {righe.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={r.descrizione}
                      onChange={(e) => aggiorna(i, "descrizione", e.target.value)}
                      placeholder="Descrizione"
                      className="flex-1"
                    />
                    <Input
                      value={r.quantita}
                      onChange={(e) => aggiorna(i, "quantita", e.target.value)}
                      inputMode="decimal"
                      className="w-16 text-right"
                    />
                    <Input
                      value={r.prezzo}
                      onChange={(e) => aggiorna(i, "prezzo", e.target.value)}
                      placeholder="€"
                      inputMode="decimal"
                      className="w-20 text-right"
                    />
                    <button
                      type="button"
                      onClick={() => setRighe((x) => x.filter((_, j) => j !== i))}
                      disabled={righe.length === 1}
                      aria-label="Rimuovi riga"
                      className="grid h-8 w-8 flex-none place-items-center rounded-md text-faint transition-colors hover:bg-surface2 hover:text-neg disabled:opacity-30"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {errore && (
              <div className="mt-3 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-md text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
            <span className="text-md text-muted">
              Imponibile <strong className="text-text">{eur(totale)}</strong>
            </span>
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvo…" : "Crea fattura"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

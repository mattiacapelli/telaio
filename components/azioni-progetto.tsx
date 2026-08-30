"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Receipt, Check, RotateCcw } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Chiamata comune: aggiorna e ricarica, mostrando l'errore se fallisce. */
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

  return { esegui, inCorso, errore, setErrore };
}

function Errore({ testo }: { testo: string | null }) {
  if (!testo) return null;
  return (
    <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
      {testo}
    </div>
  );
}

// ------------------------------------------------------- modifica progetto

export function ModificaProgetto({
  progetto,
}: {
  progetto: {
    id: string;
    nome: string;
    valore: number;
    budgetOre: number;
    inizioIl: string;
    consegnaIl: string;
    note: string;
    repoGithub: string;
    branchGithub: string;
  };
}) {
  const [aperto, setAperto] = useState(false);
  const [d, setD] = useState(progetto);
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui(`/api/progetti/${progetto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: d.nome,
        valore: d.valore || 0,
        budgetOre: d.budgetOre || 0,
        inizioIl: d.inizioIl || null,
        consegnaIl: d.consegnaIl || null,
        note: d.note || null,
        repoGithub: d.repoGithub || null,
        branchGithub: d.branchGithub || null,
      }),
    });
    if (ok) setAperto(false);
  }

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) =>
    setD({ ...d, [k]: v });

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Modifica
        </Button>
      </DialogTrigger>
      <DialogContent titolo="Modifica progetto" className="max-w-xl">
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Nome">
              <Input value={d.nome} onChange={(e) => set("nome", e.target.value)} required />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Valore (EUR)">
                <Input
                  value={String(d.valore)}
                  onChange={(e) => set("valore", Number(e.target.value) || 0)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
              <Campo etichetta="Budget ore">
                <Input
                  value={String(d.budgetOre)}
                  onChange={(e) => set("budgetOre", Number(e.target.value) || 0)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
              <Campo etichetta="Inizio">
                <Input type="date" value={d.inizioIl} onChange={(e) => set("inizioIl", e.target.value)} />
              </Campo>
              <Campo etichetta="Consegna prevista">
                <Input type="date" value={d.consegnaIl} onChange={(e) => set("consegnaIl", e.target.value)} />
              </Campo>
            </div>
            <Campo etichetta="Note">
              <Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />
            </Campo>

            <div className="rounded border border-border bg-surface2 p-2">
              <div className="mb-2 text-xs font-medium">Repository GitHub</div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Campo etichetta="Repository" nota="owner/repo oppure URL — facoltativa">
                  <Input
                    value={d.repoGithub}
                    onChange={(e) => set("repoGithub", e.target.value)}
                    placeholder="studioferrero/portale-bonaldi"
                  />
                </Campo>
                <Campo etichetta="Branch" nota="vuoto = branch predefinito">
                  <Input
                    value={d.branchGithub}
                    onChange={(e) => set("branchGithub", e.target.value)}
                    placeholder="main"
                  />
                </Campo>
              </div>
            </div>

            <Errore testo={errore} />
          </div>
          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
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

// ------------------------------------------------------------ nuova attività

export function NuovaAttivita({ progettoId }: { progettoId: string }) {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [stimaOre, setStimaOre] = useState("");
  const [scadenzaIl, setScadenza] = useState("");
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui(`/api/progetti/${progettoId}/attivita`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo,
        stimaOre: stimaOre === "" ? null : stimaOre,
        scadenzaIl: scadenzaIl || null,
      }),
    });
    if (ok) {
      setAperto(false);
      setTitolo("");
      setStimaOre("");
      setScadenza("");
    }
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <Plus /> Attività
        </Button>
      </DialogTrigger>
      <DialogContent titolo="Nuova attività">
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Titolo">
              <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} required autoFocus />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Stima ore">
                <Input value={stimaOre} onChange={(e) => setStimaOre(e.target.value)} inputMode="decimal" className="text-right" />
              </Campo>
              <Campo etichetta="Scadenza">
                <Input type="date" value={scadenzaIl} onChange={(e) => setScadenza(e.target.value)} />
              </Campo>
            </div>
            <Errore testo={errore} />
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

// ----------------------------------------------------------- nuova milestone

export function NuovaMilestone({ progettoId }: { progettoId: string }) {
  const [aperto, setAperto] = useState(false);
  const [titolo, setTitolo] = useState("");
  const [scadenzaIl, setScadenza] = useState("");
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui(`/api/progetti/${progettoId}/milestone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titolo, scadenzaIl: scadenzaIl || null }),
    });
    if (ok) {
      setAperto(false);
      setTitolo("");
      setScadenza("");
    }
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <button
          title="Nuova milestone"
          className="grid h-6 w-6 place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text"
        >
          <Plus size={13} />
        </button>
      </DialogTrigger>
      <DialogContent titolo="Nuova milestone">
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Titolo">
              <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} required autoFocus />
            </Campo>
            <Campo etichetta="Scadenza">
              <Input type="date" value={scadenzaIl} onChange={(e) => setScadenza(e.target.value)} />
            </Campo>
            <Errore testo={errore} />
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

// -------------------------------------------------- spunte e fatturazione

export function SpuntaAttivita({ id, fatta }: { id: string; fatta: boolean }) {
  const { esegui, inCorso } = useAzione();
  return (
    <button
      onClick={() =>
        esegui(`/api/attivita/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stato: fatta ? "DA_FARE" : "FATTA" }),
        })
      }
      disabled={inCorso}
      title={fatta ? "Riapri" : "Segna come fatta"}
      className="grid h-5 w-5 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text disabled:opacity-40"
    >
      {fatta ? <RotateCcw size={12} /> : <Check size={13} />}
    </button>
  );
}

export function SpuntaMilestone({
  id,
  completata,
}: {
  id: string;
  completata: boolean;
}) {
  const { esegui, inCorso } = useAzione();
  return (
    <button
      onClick={() =>
        esegui(`/api/milestone/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ completata: !completata }),
        })
      }
      disabled={inCorso}
      title={completata ? "Riapri" : "Segna come raggiunta"}
      className="grid h-5 w-5 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text disabled:opacity-40"
    >
      {completata ? <RotateCcw size={12} /> : <Check size={13} />}
    </button>
  );
}

export function FatturaProgetto({
  progettoId,
  oreDaFatturare,
}: {
  progettoId: string;
  oreDaFatturare: number;
}) {
  const { esegui, inCorso, errore } = useAzione();
  if (oreDaFatturare <= 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <Button
        size="sm"
        variant="outline"
        disabled={inCorso}
        onClick={() =>
          esegui(`/api/progetti/${progettoId}/fattura`, { method: "POST" })
        }
      >
        <Receipt /> {inCorso ? "Genero…" : "Fattura le ore"}
      </Button>
      <Errore testo={errore} />
    </div>
  );
}

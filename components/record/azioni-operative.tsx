"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Check, RotateCcw } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

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
  return { esegui, inCorso, errore };
}

const STATI_ATTIVITA = [
  { v: "DA_FARE", e: "Da fare" },
  { v: "IN_CORSO", e: "In corso" },
  { v: "BLOCCATA", e: "Bloccata" },
  { v: "FATTA", e: "Fatta" },
];

export function ModificaAttivita({
  attivita,
}: {
  attivita: {
    id: string;
    titolo: string;
    stato: string;
    stimaOre: number;
    scadenzaIl: string;
    bloccoNota: string;
  };
}) {
  const [aperto, setAperto] = useState(false);
  const [d, setD] = useState(attivita);
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui(`/api/attivita/${attivita.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stato: d.stato,
        titolo: d.titolo,
        stimaOre: d.stimaOre || 0,
        scadenzaIl: d.scadenzaIl || null,
        bloccoNota: d.bloccoNota || null,
      }),
    });
    if (ok) setAperto(false);
  }

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil /> Modifica</Button>
      </DialogTrigger>
      <DialogContent titolo="Modifica attività">
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Titolo">
              <Input value={d.titolo} onChange={(e) => set("titolo", e.target.value)} required />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Stato">
                <Select value={d.stato} onChange={(e) => set("stato", e.target.value)}>
                  {STATI_ATTIVITA.map((s) => (
                    <option key={s.v} value={s.v}>{s.e}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Stima ore">
                <Input
                  value={String(d.stimaOre)}
                  onChange={(e) => set("stimaOre", Number(e.target.value) || 0)}
                  inputMode="decimal"
                  className="text-right"
                />
              </Campo>
              <Campo etichetta="Scadenza">
                <Input type="date" value={d.scadenzaIl} onChange={(e) => set("scadenzaIl", e.target.value)} />
              </Campo>
            </div>
            {d.stato === "BLOCCATA" && (
              <Campo etichetta="Motivo del blocco">
                <Input
                  value={d.bloccoNota}
                  onChange={(e) => set("bloccoNota", e.target.value)}
                  placeholder="Es. in attesa ambiente di test"
                />
              </Campo>
            )}
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
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const STATI_TICKET = [
  { v: "APERTO", e: "Aperto" },
  { v: "IN_LAVORAZIONE", e: "In lavorazione" },
  { v: "ATTESA_CLIENTE", e: "Attesa cliente" },
  { v: "RISOLTO", e: "Risolto" },
  { v: "CHIUSO", e: "Chiuso" },
];

const PRIORITA = [
  { v: "BASSA", e: "Bassa" },
  { v: "MEDIA", e: "Media" },
  { v: "ALTA", e: "Alta" },
  { v: "URGENTE", e: "Urgente" },
];

export function ModificaTicket({
  ticket,
}: {
  ticket: {
    id: string;
    titolo: string;
    descrizione: string;
    stato: string;
    priorita: string;
    conContratto: boolean;
  };
}) {
  const [aperto, setAperto] = useState(false);
  const [d, setD] = useState(ticket);
  const { esegui, inCorso, errore } = useAzione();

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    const ok = await esegui(`/api/ticket/${ticket.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo: d.titolo,
        descrizione: d.descrizione || null,
        stato: d.stato,
        priorita: d.priorita,
        conContratto: d.conContratto,
      }),
    });
    if (ok) setAperto(false);
  }

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil /> Modifica</Button>
      </DialogTrigger>
      <DialogContent titolo="Modifica ticket">
        <form onSubmit={salva} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Titolo">
              <Input value={d.titolo} onChange={(e) => set("titolo", e.target.value)} required />
            </Campo>
            <Campo etichetta="Descrizione">
              <Textarea rows={3} value={d.descrizione} onChange={(e) => set("descrizione", e.target.value)} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Stato">
                <Select value={d.stato} onChange={(e) => set("stato", e.target.value)}>
                  {STATI_TICKET.map((s) => (
                    <option key={s.v} value={s.v}>{s.e}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Priorità">
                <Select value={d.priorita} onChange={(e) => set("priorita", e.target.value)}>
                  {PRIORITA.map((s) => (
                    <option key={s.v} value={s.v}>{s.e}</option>
                  ))}
                </Select>
              </Campo>
            </div>
            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={d.conContratto}
                onChange={(e) => set("conContratto", e.target.checked)}
              />
              Coperto da contratto di assistenza
            </label>
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
            <Button type="submit" size="sm" disabled={inCorso}>
              {inCorso ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Cambio stato rapido dalla scheda, senza aprire il dialog. */
export function CambiaStatoRapido({
  entita,
  id,
  stato,
  stati,
}: {
  entita: "attivita" | "ticket";
  id: string;
  stato: string;
  stati: { v: string; e: string }[];
}) {
  const { esegui, inCorso } = useAzione();
  return (
    <Select
      value={stato}
      disabled={inCorso}
      onChange={(ev) =>
        esegui(`/api/${entita}/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stato: ev.target.value }),
        })
      }
      className="h-6 w-auto text-xxs"
    >
      {stati.map((s) => (
        <option key={s.v} value={s.v}>{s.e}</option>
      ))}
    </Select>
  );
}

export { STATI_ATTIVITA, STATI_TICKET, PRIORITA };

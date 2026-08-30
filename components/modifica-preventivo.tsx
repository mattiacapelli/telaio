"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { eurCent } from "@/lib/format";
import { richiedeRevisione } from "@/lib/revisioni";
import {
  CorpoPreventivo,
  corpoRichiesta,
  useTotale,
  type ClienteOpzione,
  type DatiPreventivo,
} from "@/components/form-preventivo";

export function ModificaPreventivo({
  preventivo,
  clienti,
}: {
  preventivo: { id: string; stato: string; dati: DatiPreventivo };
  clienti: ClienteOpzione[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [dati, setDati] = useState<DatiPreventivo>(preventivo.dati);
  const [motivo, setMotivo] = useState("");

  // Un preventivo accettato è la base di un progetto: non si modifica.
  const bloccato = preventivo.stato === "ACCETTATO";
  const creaRevisione = richiedeRevisione(preventivo.stato);
  const riepilogo = useTotale(dati);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch(`/api/preventivi/${preventivo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoRichiesta(dati, motivo)),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setMotivo("");
    router.refresh();
  }

  if (bloccato) {
    return (
      <span className="text-md text-faint">
        Preventivo accettato: non modificabile
      </span>
    );
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Pencil /> Modifica
        </Button>
      </DialogTrigger>

      <DialogContent
        titolo={creaRevisione ? "Modifica e crea revisione" : "Modifica preventivo"}
        descrizione={
          creaRevisione
            ? "Il preventivo è già stato inviato: la versione attuale verrà conservata come revisione."
            : "Il preventivo è in bozza: le modifiche sovrascrivono la versione corrente."
        }
        className="max-w-3xl"
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto">
            <CorpoPreventivo
              dati={dati}
              setDati={setDati}
              clienti={clienti}
              mostraMotivo={creaRevisione}
              motivo={motivo}
              setMotivo={setMotivo}
            />
            {errore && (
              <div className="mx-5 mb-4 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-md text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-border px-5 py-3">
            <div className="text-md text-muted">
              Totale{" "}
              <strong className="text-md text-text">
                {eurCent(riepilogo.totale)}
              </strong>
            </div>
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvo…" : creaRevisione ? "Salva come revisione" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

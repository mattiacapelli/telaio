"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { eurCent } from "@/lib/format";
import {
  CorpoPreventivo,
  corpoRichiesta,
  datiVuoti,
  useTotale,
  type ClienteOpzione,
  type DatiPreventivo,
} from "@/components/form-preventivo";

export function NuovoPreventivo({
  clienti,
  tariffaListino,
}: {
  clienti: ClienteOpzione[];
  tariffaListino: number;
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [dati, setDati] = useState<DatiPreventivo>(datiVuoti(tariffaListino));

  const riepilogo = useTotale(dati);

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);

    const r = await fetch("/api/preventivi", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoRichiesta(dati)),
    }).catch(() => null);

    setSalvando(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Salvataggio non riuscito");
      return;
    }

    setAperto(false);
    setDati(datiVuoti(tariffaListino));
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Nuovo preventivo
        </Button>
      </DialogTrigger>

      <DialogContent
        titolo="Nuovo preventivo"
        descrizione="Il numero viene assegnato al salvataggio. Nasce in bozza."
        className="max-w-3xl"
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex-1 overflow-y-auto">
            <CorpoPreventivo dati={dati} setDati={setDati} clienti={clienti} />
            {errore && (
              <div className="mx-5 mb-4 rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-xs text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-border px-5 py-3">
            <div className="text-xs text-muted">
              Totale{" "}
              <strong className="text-xs text-text">
                {eurCent(riepilogo.totale)}
              </strong>
              <span className="ml-1 text-faint">
                (imponibile {eurCent(riepilogo.imponibile)})
              </span>
            </div>
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvo…" : "Crea preventivo"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

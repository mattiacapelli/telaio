"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Star, Percent } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Campo } from "@/components/ui/input";
import { EliminaRecord } from "@/components/elimina-record";

export type RegimeFiscale = {
  id: string;
  nome: string;
  coefficienteRedditivita: number;
  aliquotaSostitutiva: number;
  aliquotaInps: number;
  minimaleInps: number | null;
  predefinito: boolean;
};

/**
 * Anagrafica dei regimi fiscali (coefficiente di redditività, aliquota
 * dell'imposta sostitutiva, aliquota INPS) da assegnare a ogni azienda.
 *
 * Oggi il calcolatore in Dashboard → Tasse sa applicare solo la formula del
 * forfettario, ma la tabella resta generica: altri regimi si possono
 * aggiungere da qui, pronti per quando servirà implementarne il calcolo.
 */
export function ElencoRegimiFiscali({ regimi }: { regimi: RegimeFiscale[] }) {
  const router = useRouter();
  const [errore, setErrore] = useState<string | null>(null);

  async function rendiPredefinito(id: string) {
    await fetch(`/api/regimi-fiscali/${id}`, {
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
        {regimi.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-faint">
            Nessun regime configurato: il calcolatore tasse non può stimare nulla.
          </div>
        ) : (
          regimi.map((r) => (
            <div key={r.id} className="group flex items-center gap-2 border-b border-border px-3 py-2 last:border-0">
              <Percent size={13} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{r.nome}</div>
                <div className="truncate text-xs text-faint">
                  coeff. {r.coefficienteRedditivita}% · sostitutiva {r.aliquotaSostitutiva}% · INPS {r.aliquotaInps}%
                  {r.minimaleInps !== null && ` · minimale €${r.minimaleInps.toLocaleString("it-IT")}`}
                </div>
              </div>
              {r.predefinito ? (
                <span className="flex flex-none items-center gap-1 text-xs text-accent">
                  <Star size={11} /> predefinito
                </span>
              ) : (
                <button
                  onClick={() => rendiPredefinito(r.id)}
                  className="flex-none text-xs text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"
                >
                  rendi predefinito
                </button>
              )}
              <EliminaRecord entita="regimeFiscale" id={r.id} nome={r.nome} size="sm" variant="ghost" />
            </div>
          ))
        )}
      </div>

      <div className="flex">
        <div className="flex-1" />
        <NuovoRegimeFiscale />
      </div>
    </div>
  );
}

function NuovoRegimeFiscale() {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [nome, setNome] = useState("");
  const [coefficienteRedditivita, setCoefficienteRedditivita] = useState("");
  const [aliquotaSostitutiva, setAliquotaSostitutiva] = useState("");
  const [aliquotaInps, setAliquotaInps] = useState("");
  const [minimaleInps, setMinimaleInps] = useState("");
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch("/api/regimi-fiscali", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        coefficienteRedditivita,
        aliquotaSostitutiva,
        aliquotaInps,
        minimaleInps: minimaleInps || null,
      }),
    }).catch(() => null);
    setInCorso(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Creazione non riuscita");
      return;
    }
    setAperto(false);
    setNome("");
    setCoefficienteRedditivita("");
    setAliquotaSostitutiva("");
    setAliquotaInps("");
    setMinimaleInps("");
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost"><Plus /> Nuovo regime</Button>
      </DialogTrigger>
      <DialogContent titolo="Nuovo regime fiscale">
        <form onSubmit={crea} className="flex flex-col">
          <div className="flex flex-col gap-3 p-4">
            <Campo etichetta="Nome">
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es. Forfettario"
                required
                autoFocus
              />
            </Campo>
            <Campo etichetta="Coefficiente di redditività" nota="% dell'incassato riconosciuta come reddito">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={coefficienteRedditivita}
                onChange={(e) => setCoefficienteRedditivita(e.target.value)}
                placeholder="Es. 78"
                required
              />
            </Campo>
            <Campo etichetta="Aliquota imposta sostitutiva" nota="% sul reddito imponibile fiscale">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={aliquotaSostitutiva}
                onChange={(e) => setAliquotaSostitutiva(e.target.value)}
                placeholder="Es. 15"
                required
              />
            </Campo>
            <Campo etichetta="Aliquota INPS" nota="% sul reddito lordo forfettario">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={aliquotaInps}
                onChange={(e) => setAliquotaInps(e.target.value)}
                placeholder="Es. 26,07"
                required
              />
            </Campo>
            <Campo etichetta="Minimale INPS" nota="Facoltativo: soglia minima di reddito su cui calcolare i contributi">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={minimaleInps}
                onChange={(e) => setMinimaleInps(e.target.value)}
                placeholder="Es. 4903,25"
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
            <Button
              type="submit"
              size="sm"
              disabled={inCorso || !nome.trim() || !coefficienteRedditivita || !aliquotaSostitutiva || !aliquotaInps}
            >
              {inCorso ? "Creo…" : "Crea"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

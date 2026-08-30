"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Pencil, Star } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AMBITI, ETICHETTE_CAMPO } from "@/lib/testi";

type Testo = {
  id: string;
  ambito: string;
  campo: string;
  titolo: string;
  testo: string;
  predefinito: boolean;
};

const CAMPI_PER_AMBITO: Record<string, string[]> = {
  PREVENTIVO: ["premessa", "tempiConsegna", "modalitaPagamento", "note"],
  CONTRATTO: ["premessa", "oggetto", "condizioniPagamento", "condizioniServizio", "note"],
  ENTRAMBI: ["premessa", "modalitaPagamento", "condizioniPagamento", "note"],
};

export function TestiStandard({ testi }: { testi: Testo[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-xxs text-faint">
          {testi.length} testi · {testi.filter((t) => t.predefinito).length} predefiniti
        </span>
        <div className="flex-1" />
        <FormTesto onFatto={() => router.refresh()} />
      </div>

      {testi.length === 0 ? (
        <div className="px-3 py-5 text-center text-xs text-faint">
          Nessun testo salvato. I testi predefiniti vengono inseriti
          automaticamente nei nuovi preventivi e contratti.
        </div>
      ) : (
        testi.map((t) => (
          <div key={t.id} className="group flex items-start gap-2 border-b border-border px-3 py-2 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium">{t.titolo}</span>
                {t.predefinito && (
                  <Badge tono="accento">
                    <Star size={9} /> predefinito
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 text-xxs text-faint">
                {ETICHETTE_CAMPO[t.campo] ?? t.campo} · {AMBITI[t.ambito]}
              </div>
              <div className="mt-1 line-clamp-2 text-xxs text-muted">{t.testo}</div>
            </div>
            <FormTesto testo={t} onFatto={() => router.refresh()} />
            <button
              onClick={async () => {
                if (!confirm(`Eliminare «${t.titolo}»?`)) return;
                await fetch(`/api/testi/${t.id}`, { method: "DELETE" }).catch(() => null);
                router.refresh();
              }}
              title="Elimina"
              className="grid h-6 w-6 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

function FormTesto({ testo, onFatto }: { testo?: Testo; onFatto: () => void }) {
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [d, setD] = useState({
    titolo: testo?.titolo ?? "",
    testo: testo?.testo ?? "",
    ambito: testo?.ambito ?? "ENTRAMBI",
    campo: testo?.campo ?? "condizioniPagamento",
    predefinito: testo?.predefinito ?? false,
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });
  const campi = CAMPI_PER_AMBITO[d.ambito] ?? [];

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch(testo ? `/api/testi/${testo.id}` : "/api/testi", {
      method: testo ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    }).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setAperto(false);
    onFatto();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        {testo ? (
          <button
            title="Modifica"
            className="grid h-6 w-6 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-text group-hover:opacity-100"
          >
            <Pencil size={13} />
          </button>
        ) : (
          <Button size="sm" variant="ghost"><Plus /> Nuovo testo</Button>
        )}
      </DialogTrigger>
      <DialogContent
        titolo={testo ? "Modifica testo" : "Nuovo testo standard"}
        descrizione="I testi predefiniti vengono copiati nei nuovi documenti. Modificarli non riscrive i documenti già emessi."
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Titolo" nota="Solo per riconoscerlo in questo elenco">
              <Input
                value={d.titolo}
                onChange={(e) => set("titolo", e.target.value)}
                placeholder="Es. Pagamento 30 giorni"
                required
                autoFocus
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Si applica a">
                <Select
                  value={d.ambito}
                  onChange={(e) => {
                    const nuovo = e.target.value;
                    const validi = CAMPI_PER_AMBITO[nuovo] ?? [];
                    // Cambiando ambito il campo scelto potrebbe non esistere più.
                    setD({
                      ...d,
                      ambito: nuovo,
                      campo: validi.includes(d.campo) ? d.campo : validi[0],
                    });
                  }}
                >
                  {Object.entries(AMBITI).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Sezione del documento">
                <Select value={d.campo} onChange={(e) => set("campo", e.target.value)}>
                  {campi.map((c) => (
                    <option key={c} value={c}>{ETICHETTE_CAMPO[c] ?? c}</option>
                  ))}
                </Select>
              </Campo>
            </div>

            <Campo
              etichetta="Testo"
              nota="Puoi usare segnaposto come {cliente}, {numero}, {canone}"
            >
              <Textarea
                rows={6}
                value={d.testo}
                onChange={(e) => set("testo", e.target.value)}
                placeholder="Il pagamento è dovuto entro 30 giorni dalla data fattura…"
                required
              />
            </Campo>

            <label className="flex items-center gap-1.5 text-xs text-muted">
              <input
                type="checkbox"
                checked={d.predefinito}
                onChange={(e) => set("predefinito", e.target.checked)}
              />
              Inserisci automaticamente nei nuovi documenti
            </label>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-xs text-neg">
                {errore}
              </div>
            )}
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

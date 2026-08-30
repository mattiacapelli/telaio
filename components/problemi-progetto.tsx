"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, AlertTriangle, Check } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { dataEstesa, ore } from "@/lib/format";

type Problema = {
  id: string;
  titolo: string;
  descrizione: string | null;
  gravita: string;
  stato: string;
  risoluzione: string | null;
  impattoOre: number | null;
  segnalatoDa: string | null;
  apertoIl: Date | string;
};

const GRAVITA: Record<string, string> = {
  BASSA: "Bassa",
  MEDIA: "Media",
  ALTA: "Alta",
  CRITICA: "Critica",
};

const STATI: Record<string, string> = {
  APERTO: "Aperto",
  IN_GESTIONE: "In gestione",
  RISOLTO: "Risolto",
  ACCETTATO: "Accettato",
};

const CHIUSI = ["RISOLTO", "ACCETTATO"];

export function ProblemiProgetto({
  progettoId,
  problemi,
}: {
  progettoId: string;
  problemi: Problema[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [titolo, setTitolo] = useState("");
  const [descrizione, setDescrizione] = useState("");
  const [gravita, setGravita] = useState("MEDIA");
  const [impattoOre, setImpatto] = useState("");

  async function crea(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setInCorso(true);
    const r = await fetch(`/api/progetti/${progettoId}/problemi`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo,
        descrizione: descrizione || null,
        gravita,
        impattoOre: impattoOre === "" ? null : impattoOre,
      }),
    }).catch(() => null);
    setInCorso(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setAperto(false);
    setTitolo("");
    setDescrizione("");
    setGravita("MEDIA");
    setImpatto("");
    router.refresh();
  }

  async function cambiaStato(id: string, stato: string) {
    await fetch(`/api/problemi/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stato }),
    }).catch(() => null);
    router.refresh();
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <h2 className="text-md font-medium">Criticità</h2>
        <span className="text-xs text-faint">
          {problemi.filter((p) => !CHIUSI.includes(p.stato)).length} aperte
        </span>
        <div className="flex-1" />
        <Dialog open={aperto} onOpenChange={setAperto}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost">
              <Plus /> Segnala
            </Button>
          </DialogTrigger>
          <DialogContent
            titolo="Segnala una criticità"
            descrizione="Ritardi, blocchi, scelte da rivedere: cose che riguardano l'andamento del lavoro."
          >
            <form onSubmit={crea} className="flex flex-col">
              <div className="flex flex-col gap-3 p-4">
                <Campo etichetta="Titolo">
                  <Input value={titolo} onChange={(e) => setTitolo(e.target.value)} required autoFocus />
                </Campo>
                <Campo etichetta="Descrizione">
                  <Textarea rows={3} value={descrizione} onChange={(e) => setDescrizione(e.target.value)} />
                </Campo>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Campo etichetta="Gravità">
                    <Select value={gravita} onChange={(e) => setGravita(e.target.value)}>
                      {Object.entries(GRAVITA).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </Select>
                  </Campo>
                  <Campo etichetta="Impatto stimato (ore)" nota="Facoltativo">
                    <Input value={impattoOre} onChange={(e) => setImpatto(e.target.value)} inputMode="decimal" className="text-right" />
                  </Campo>
                </div>
                {errore && (
                  <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
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
                  {inCorso ? "Salvo…" : "Segnala"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {problemi.length === 0 ? (
        <div className="px-3 py-5 text-center text-md text-faint">
          Nessuna criticità segnalata
        </div>
      ) : (
        problemi.map((p) => {
          const chiuso = CHIUSI.includes(p.stato);
          return (
            <div
              key={p.id}
              className="flex items-start gap-2 border-b border-border px-2 py-2 last:border-0"
            >
              <AlertTriangle
                size={13}
                className={`mt-0.5 flex-none ${
                  chiuso
                    ? "text-faint"
                    : p.gravita === "CRITICA" || p.gravita === "ALTA"
                      ? "text-neg"
                      : "text-muted"
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className={`text-md ${chiuso ? "text-muted line-through" : ""}`}>
                  {p.titolo}
                </div>
                {p.descrizione && (
                  <div className="mt-0.5 text-xs text-faint">{p.descrizione}</div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-faint">
                  <Badge tono={chiuso ? "neutro" : p.gravita === "CRITICA" ? "attenzione" : "neutro"}>
                    {GRAVITA[p.gravita]}
                  </Badge>
                  <span>{STATI[p.stato]}</span>
                  {p.impattoOre !== null && <span>· impatto {ore(p.impattoOre)}</span>}
                  <span>· {dataEstesa(p.apertoIl)}</span>
                </div>
              </div>
              {!chiuso && (
                <button
                  onClick={() => cambiaStato(p.id, "RISOLTO")}
                  title="Segna come risolta"
                  className="grid h-5 w-5 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-pos"
                >
                  <Check size={13} />
                </button>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

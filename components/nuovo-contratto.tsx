"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TitoloConProdotti } from "@/components/titolo-con-prodotti";

export function NuovoContratto({
  clienti,
  progetti,
  prodotti = [],
  aziende = [],
}: {
  clienti: { id: string; ragioneSociale: string; tariffaOraria: number }[];
  progetti: { id: string; nome: string }[];
  prodotti?: { id: string; nome: string }[];
  aziende?: { id: string; ragioneSociale: string }[];
}) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [prodottiIds, setProdottiIds] = useState<string[]>([]);

  const oggi = new Date().toISOString().slice(0, 10);
  const [d, setD] = useState({
    titolo: "",
    clienteId: "",
    progettoId: "",
    tipo: "ASSISTENZA_ORE",
    canone: "",
    periodicita: "MENSILE",
    monteOre: "",
    tariffaExtra: "",
    inizioIl: oggi,
    scadeIl: "",
    rinnovoAutomatico: true,
    preavvisoGiorni: "30",
    note: "",
    aziendaId: "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    if (!d.titolo.trim()) {
      setErrore("il titolo è obbligatorio");
      return;
    }
    setSalvando(true);
    const r = await fetch("/api/contratti", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...d,
        progettoId: d.progettoId || null,
        canone: d.canone || 0,
        monteOre: d.monteOre === "" ? null : d.monteOre,
        tariffaExtra: d.tariffaExtra === "" ? null : d.tariffaExtra,
        scadeIl: d.scadeIl || null,
        note: d.note || null,
        aziendaId: d.aziendaId || null,
        prodottiIds,
      }),
    }).catch(() => null);
    setSalvando(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    const creato = await r.json().catch(() => null);
    setAperto(false);
    if (creato?.id) router.push(`/contratti/${creato.id}`);
    else router.refresh();
  }

  const assistenza = d.tipo === "ASSISTENZA_ORE";

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus /> Nuovo contratto</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Nuovo contratto"
        descrizione="Il numero viene assegnato al salvataggio."
        className="max-w-xl"
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo
              etichetta="Titolo"
              nota={prodotti.length > 0 ? "Digita per cercare un prodotto da collegare" : undefined}
            >
              <TitoloConProdotti
                titolo={d.titolo}
                onTitoloChange={(v) => set("titolo", v)}
                prodotti={prodotti}
                selezionati={prodottiIds}
                onSelezionatiChange={setProdottiIds}
              />
            </Campo>

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Cliente">
                <Select value={d.clienteId} onChange={(e) => set("clienteId", e.target.value)} required>
                  <option value="">Scegli…</option>
                  {clienti.map((c) => (
                    <option key={c.id} value={c.id}>{c.ragioneSociale}</option>
                  ))}
                </Select>
              </Campo>
              <Campo etichetta="Tipo">
                <Select value={d.tipo} onChange={(e) => set("tipo", e.target.value)}>
                  <option value="ASSISTENZA_ORE">Assistenza a ore</option>
                  <option value="CANONE_FISSO">Canone fisso</option>
                  <option value="PROGETTO">Contratto di progetto</option>
                </Select>
              </Campo>
            </div>

            {d.tipo === "PROGETTO" && (
              <Campo etichetta="Progetto collegato">
                <Select value={d.progettoId} onChange={(e) => set("progettoId", e.target.value)}>
                  <option value="">Nessuno</option>
                  {progetti.map((p) => (
                    <option key={p.id} value={p.id}>{p.nome}</option>
                  ))}
                </Select>
              </Campo>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Canone (EUR)">
                <Input
                  value={d.canone}
                  onChange={(e) => set("canone", e.target.value)}
                  inputMode="decimal"
                  className="text-right"
                  required
                />
              </Campo>
              <Campo etichetta="Periodicità">
                <Select value={d.periodicita} onChange={(e) => set("periodicita", e.target.value)}>
                  <option value="MENSILE">Mensile</option>
                  <option value="TRIMESTRALE">Trimestrale</option>
                  <option value="SEMESTRALE">Semestrale</option>
                  <option value="ANNUALE">Annuale</option>
                </Select>
              </Campo>
            </div>

            {assistenza && (
              <div className="grid gap-3 rounded border border-border bg-surface2 p-2 sm:grid-cols-2">
                <Campo etichetta="Monte ore per periodo" nota="Ore incluse nel canone">
                  <Input
                    value={d.monteOre}
                    onChange={(e) => set("monteOre", e.target.value)}
                    inputMode="decimal"
                    className="text-right"
                    placeholder="20"
                  />
                </Campo>
                <Campo etichetta="Tariffa ore extra" nota="Vuoto = tariffa del cliente">
                  <Input
                    value={d.tariffaExtra}
                    onChange={(e) => set("tariffaExtra", e.target.value)}
                    inputMode="decimal"
                    className="text-right"
                  />
                </Campo>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <Campo etichetta="Inizio">
                <Input type="date" value={d.inizioIl} onChange={(e) => set("inizioIl", e.target.value)} required />
              </Campo>
              <Campo etichetta="Scadenza" nota="Vuoto = senza scadenza">
                <Input type="date" value={d.scadeIl} onChange={(e) => set("scadeIl", e.target.value)} />
              </Campo>
              <Campo etichetta="Preavviso disdetta (giorni)">
                <Input
                  value={d.preavvisoGiorni}
                  onChange={(e) => set("preavvisoGiorni", e.target.value)}
                  inputMode="numeric"
                  className="text-right"
                />
              </Campo>
              <label className="flex h-[32px] items-end gap-1.5 pb-1 text-md text-muted">
                <input
                  type="checkbox"
                  checked={d.rinnovoAutomatico}
                  onChange={(e) => set("rinnovoAutomatico", e.target.checked)}
                />
                Rinnovo automatico
              </label>
            </div>

            {aziende.length > 1 && (
              <Campo etichetta="Ragione sociale emittente" nota="Vuoto = quella predefinita">
                <Select value={d.aziendaId} onChange={(e) => set("aziendaId", e.target.value)}>
                  <option value="">Predefinita</option>
                  {aziende.map((a) => (
                    <option key={a.id} value={a.id}>{a.ragioneSociale}</option>
                  ))}
                </Select>
              </Campo>
            )}

            <Campo etichetta="Note">
              <Textarea rows={2} value={d.note} onChange={(e) => set("note", e.target.value)} />
            </Campo>

            {errore && (
              <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
                {errore}
              </div>
            )}
          </div>

          <div className="flex flex-none items-center gap-2 border-t border-border px-4 py-3">
            <div className="flex-1" />
            <Button type="button" variant="outline" size="sm" onClick={() => setAperto(false)}>
              Annulla
            </Button>
            <Button type="submit" size="sm" disabled={salvando}>
              {salvando ? "Salvo…" : "Crea contratto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

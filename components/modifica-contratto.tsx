"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Dialog, DialogTrigger, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PERIODICITA } from "@/lib/contratti";
import { IntestazioneSezione } from "@/components/nuovo-contratto";

export type ContrattoModificabile = {
  id: string;
  titolo: string;
  canone: number;
  /** Sola lettura: non modificabile dopo la creazione. */
  periodicita: string;
  monteOre: number | null;
  tariffaExtra: number | null;
  /** Sola lettura: decide se mostrare monteOre/tariffaExtra. */
  tipo: string;
  scadeIl: string | null;
  rinnovoAutomatico: boolean;
  preavvisoGiorni: number;
  giornoFatturazione: number | null;
  note: string | null;
};

/**
 * Modifica un contratto già creato.
 *
 * Cliente, tipo, periodicità e data di inizio restano fissi: cambiarli
 * dopo la creazione romperebbe il calcolo dei periodi già fatturati.
 * Stato e prodotti collegati hanno già i loro controlli dedicati
 * (AzioniContratto, ProdottiContratto) e non vanno duplicati qui.
 */
export function ModificaContratto({ contratto }: { contratto: ContrattoModificabile }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [d, setD] = useState({
    titolo: contratto.titolo,
    canone: String(contratto.canone),
    monteOre: contratto.monteOre === null ? "" : String(contratto.monteOre),
    tariffaExtra: contratto.tariffaExtra === null ? "" : String(contratto.tariffaExtra),
    giornoFatturazione: contratto.giornoFatturazione === null ? "" : String(contratto.giornoFatturazione),
    scadeIl: contratto.scadeIl ?? "",
    rinnovoAutomatico: contratto.rinnovoAutomatico,
    preavvisoGiorni: String(contratto.preavvisoGiorni),
    note: contratto.note ?? "",
  });

  const set = <K extends keyof typeof d>(k: K, v: (typeof d)[K]) => setD({ ...d, [k]: v });
  const assistenza = contratto.tipo === "ASSISTENZA_ORE";

  async function salva(e: React.FormEvent) {
    e.preventDefault();
    setErrore(null);
    setSalvando(true);
    const r = await fetch(`/api/contratti/${contratto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titolo: d.titolo,
        canone: d.canone || 0,
        monteOre: d.monteOre === "" ? null : d.monteOre,
        tariffaExtra: d.tariffaExtra === "" ? null : d.tariffaExtra,
        giornoFatturazione: d.giornoFatturazione === "" ? null : d.giornoFatturazione,
        scadeIl: d.scadeIl || null,
        rinnovoAutomatico: d.rinnovoAutomatico,
        preavvisoGiorni: d.preavvisoGiorni,
        note: d.note || null,
      }),
    }).catch(() => null);
    setSalvando(false);

    if (!r || !r.ok) {
      const x = await r?.json().catch(() => null);
      setErrore(x?.errore ?? "Salvataggio non riuscito");
      return;
    }
    setAperto(false);
    router.refresh();
  }

  return (
    <Dialog open={aperto} onOpenChange={setAperto}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Pencil /> Modifica</Button>
      </DialogTrigger>
      <DialogContent
        titolo="Modifica contratto"
        descrizione="Cliente, tipo, periodicità e data di inizio non sono modificabili dopo la creazione."
        className="max-w-xl"
      >
        <form onSubmit={salva} className="flex min-h-0 flex-col">
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
            <Campo etichetta="Titolo">
              <Input value={d.titolo} onChange={(e) => set("titolo", e.target.value)} required autoFocus />
            </Campo>

            <IntestazioneSezione>Economia</IntestazioneSezione>

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
              <Campo etichetta="Periodicità" nota="Non modificabile">
                <Input value={PERIODICITA[contratto.periodicita]} disabled />
              </Campo>
            </div>

            {assistenza && (
              <div className="grid gap-3 rounded border border-border bg-surface2 p-2 sm:grid-cols-2">
                <Campo etichetta="Monte ore per periodo">
                  <Input
                    value={d.monteOre}
                    onChange={(e) => set("monteOre", e.target.value)}
                    inputMode="decimal"
                    className="text-right"
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

            <Campo etichetta="Giorno di fatturazione" nota="Vuoto = nessuna fattura automatica">
              <Select
                value={d.giornoFatturazione}
                onChange={(e) => set("giornoFatturazione", e.target.value)}
              >
                <option value="">Nessuna (manuale)</option>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </Select>
            </Campo>

            <IntestazioneSezione>Durata</IntestazioneSezione>

            <div className="grid gap-3 sm:grid-cols-2">
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
            </div>

            <label className="flex items-center gap-1.5 text-md text-muted">
              <input
                type="checkbox"
                checked={d.rinnovoAutomatico}
                onChange={(e) => set("rinnovoAutomatico", e.target.checked)}
              />
              Rinnovo automatico
            </label>

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
              {salvando ? "Salvo…" : "Salva"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

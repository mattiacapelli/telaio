"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { GripVertical, Plus, Trash2, Eye, EyeOff, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Campo } from "@/components/ui/input";
import {
  CATALOGO_BLOCCHI, definizioneBlocco, configPredefinitaBlocco,
} from "@/lib/pdf/blocchi";
import type { BloccoPdf } from "@/lib/pdf/blocchi";
import { cn } from "@/lib/utils";

/**
 * Builder drag & drop per i modelli di stampa.
 *
 * I blocchi sono in sequenza verticale, non a posizionamento libero: si
 * riordinano trascinando, si attivano o disattivano, e ognuno ha il suo
 * pannello di configurazione. L'impaginazione resta al generatore, che sa
 * andare a capo pagina da solo — qui si decide solo cosa stampare e in che
 * ordine.
 */
export function PdfBuilder({
  modello,
}: {
  modello: { id: string; nome: string; ambito: "PREVENTIVO" | "CONTRATTO"; blocchi: BloccoPdf[] };
}) {
  const router = useRouter();
  const [blocchi, setBlocchi] = useState<BloccoPdf[]>(modello.blocchi);
  const [selezionato, setSelezionato] = useState<string | null>(blocchi[0]?.id ?? null);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [sopra, setSopra] = useState<string | null>(null);
  const [tavolozza, setTavolozza] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [sporco, setSporco] = useState(false);
  const [anteprima, setAnteprima] = useState<string | null>(null);
  const [caricandoAnteprima, setCaricandoAnteprima] = useState(false);

  const disponibili = CATALOGO_BLOCCHI.filter((d) => d.ambiti.includes(modello.ambito));
  const blocco = blocchi.find((b) => b.id === selezionato) ?? null;
  const definizione = blocco ? definizioneBlocco(blocco.tipo) : null;

  function aggiorna(nuovi: BloccoPdf[]) {
    setBlocchi(nuovi);
    setSporco(true);
  }

  function aggiungi(tipo: string) {
    // I blocchi unici non si aggiungono due volte: duplicherebbero un
    // riepilogo o un'intestazione, che non ha senso stampare due volte.
    const def = definizioneBlocco(tipo);
    if (def?.unico && blocchi.some((b) => b.tipo === tipo)) {
      setTavolozza(false);
      return;
    }
    const nuovo: BloccoPdf = {
      id: `b${Date.now().toString(36)}`,
      tipo,
      attivo: true,
      config: configPredefinitaBlocco(tipo),
    };
    aggiorna([...blocchi, nuovo]);
    setSelezionato(nuovo.id);
    setTavolozza(false);
  }

  function elimina(id: string) {
    aggiorna(blocchi.filter((b) => b.id !== id));
    if (selezionato === id) setSelezionato(null);
  }

  function alterna(id: string) {
    aggiorna(blocchi.map((b) => (b.id === id ? { ...b, attivo: !b.attivo } : b)));
  }

  function aggiornaConfig(id: string, chiave: string, valore: string | number | boolean) {
    aggiorna(
      blocchi.map((b) => (b.id === id ? { ...b, config: { ...b.config, [chiave]: valore } } : b)),
    );
  }

  function sposta(daId: string, aId: string) {
    if (daId === aId) return;
    const indiceD = blocchi.findIndex((b) => b.id === daId);
    const indiceA = blocchi.findIndex((b) => b.id === aId);
    if (indiceD === -1 || indiceA === -1) return;
    const copia = [...blocchi];
    const [rimosso] = copia.splice(indiceD, 1);
    copia.splice(indiceA, 0, rimosso);
    aggiorna(copia);
  }

  async function salva() {
    setSalvando(true);
    const r = await fetch(`/api/modelli-pdf/${modello.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocchi }),
    }).catch(() => null);
    setSalvando(false);
    if (r?.ok) {
      setSporco(false);
      router.refresh();
    }
  }

  // L'anteprima si rigenera da sola mentre si lavora, non solo al salvataggio:
  // altrimenti bisognerebbe salvare per vedere ogni piccola modifica.
  const generaAnteprima = useCallback(async () => {
    setCaricandoAnteprima(true);
    const r = await fetch(`/api/modelli-pdf/${modello.id}/anteprima`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocchi }),
    }).catch(() => null);
    setCaricandoAnteprima(false);
    if (!r?.ok) return;
    const blob = await r.blob();
    setAnteprima((prec) => {
      if (prec) URL.revokeObjectURL(prec);
      return URL.createObjectURL(blob);
    });
  }, [modello.id, blocchi]);

  useEffect(() => {
    const t = setTimeout(generaAnteprima, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocchi]);

  useEffect(() => {
    generaAnteprima();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (anteprima) URL.revokeObjectURL(anteprima); }, [anteprima]);

  return (
    <div className="flex h-full min-h-0">
      {/* --------------------------------------------------- elenco blocchi */}
      <div className="flex w-[300px] flex-none flex-col border-r border-border bg-surface">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <span className="text-md font-medium">Blocchi</span>
          <div className="flex-1" />
          <Button size="sm" variant="ghost" onClick={() => setTavolozza((v) => !v)}>
            <Plus /> Aggiungi
          </Button>
        </div>

        {tavolozza && (
          <div className="max-h-[220px] overflow-y-auto border-b border-border">
            {disponibili.map((d) => {
              const usato = d.unico && blocchi.some((b) => b.tipo === d.tipo);
              return (
                <button
                  key={d.tipo}
                  onClick={() => aggiungi(d.tipo)}
                  disabled={usato}
                  className="flex w-full items-start gap-2 border-b border-border px-3 py-2 text-left last:border-0 hover:bg-[var(--alpha-lighter)] disabled:opacity-40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium">{d.etichetta}</div>
                    <div className="truncate text-xs text-faint">
                      {usato ? "già presente nel modello" : d.descrizione}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {blocchi.length === 0 ? (
            <div className="px-2 py-8 text-center text-xs text-faint">
              Aggiungi un blocco per iniziare a comporre il documento.
            </div>
          ) : (
            blocchi.map((b) => {
              const def = definizioneBlocco(b.tipo);
              return (
                <div
                  key={b.id}
                  draggable
                  onDragStart={() => setTrascinato(b.id)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setSopra(b.id);
                  }}
                  onDragLeave={() => setSopra((s) => (s === b.id ? null : s))}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (trascinato) sposta(trascinato, b.id);
                    setTrascinato(null);
                    setSopra(null);
                  }}
                  onDragEnd={() => {
                    setTrascinato(null);
                    setSopra(null);
                  }}
                  onClick={() => setSelezionato(b.id)}
                  className={cn(
                    "mb-1 flex items-center gap-1.5 rounded-md border px-2 py-2 transition-colors",
                    selezionato === b.id ? "border-accent bg-accent-soft" : "border-border bg-surface2",
                    sopra === b.id && "border-dashed border-accent",
                    trascinato === b.id && "opacity-50",
                    !b.attivo && "opacity-50",
                  )}
                >
                  <GripVertical size={13} className="flex-none cursor-grab text-faint" />
                  <div className="min-w-0 flex-1 cursor-pointer">
                    <div className="truncate text-xs font-medium">{def?.etichetta ?? b.tipo}</div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); alterna(b.id); }}
                    title={b.attivo ? "Disattiva" : "Attiva"}
                    className="grid h-5 w-5 flex-none place-items-center rounded text-faint hover:text-text"
                  >
                    {b.attivo ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); elimina(b.id); }}
                    title="Rimuovi"
                    className="grid h-5 w-5 flex-none place-items-center rounded text-faint hover:text-neg"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-border p-2">
          {sporco && <span className="text-xs text-muted">non salvato</span>}
          <div className="flex-1" />
          <Button size="sm" onClick={salva} disabled={salvando || !sporco}>
            {salvando ? <Loader2 className="animate-spin" /> : <Save />}
            {salvando ? "Salvo…" : "Salva modello"}
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------- pannello blocco */}
      <div className="flex w-[280px] flex-none flex-col overflow-y-auto border-r border-border bg-surface">
        {!blocco || !definizione ? (
          <div className="p-3 text-xs text-faint">
            Seleziona un blocco per configurarlo.
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div>
              <div className="text-xs font-medium">{definizione.etichetta}</div>
              <div className="mt-0.5 text-xs text-faint">{definizione.descrizione}</div>
            </div>

            {definizione.campi.length === 0 ? (
              <div className="text-xs text-faint">Nessuna opzione da configurare.</div>
            ) : (
              definizione.campi.map((c) => (
                <Campo key={c.chiave} etichetta={c.etichetta} nota={c.nota}>
                  {c.tipo === "booleano" ? (
                    <label className="flex items-center gap-1.5 text-xs text-muted">
                      <input
                        type="checkbox"
                        checked={Boolean(blocco.config[c.chiave])}
                        onChange={(e) => aggiornaConfig(blocco.id, c.chiave, e.target.checked)}
                      />
                      Attivo
                    </label>
                  ) : c.tipo === "scelta" ? (
                    <Select
                      value={String(blocco.config[c.chiave] ?? "")}
                      onChange={(e) => aggiornaConfig(blocco.id, c.chiave, e.target.value)}
                    >
                      {(c.opzioni ?? []).map((o) => (
                        <option key={o.valore} value={o.valore}>{o.etichetta}</option>
                      ))}
                    </Select>
                  ) : (
                    <Input
                      value={String(blocco.config[c.chiave] ?? "")}
                      inputMode={c.tipo === "numero" ? "decimal" : undefined}
                      onChange={(e) =>
                        aggiornaConfig(
                          blocco.id,
                          c.chiave,
                          c.tipo === "numero" ? Number(e.target.value) || 0 : e.target.value,
                        )
                      }
                    />
                  )}
                </Campo>
              ))
            )}
          </div>
        )}
      </div>

      {/* ------------------------------------------------------- anteprima */}
      <div className="flex min-w-0 flex-1 flex-col bg-[#525659]">
        <div className="flex h-9 flex-none items-center gap-2 border-b border-border bg-surface px-3">
          <span className="text-xs text-muted">Anteprima con dati di esempio</span>
          {caricandoAnteprima && <Loader2 size={12} className="animate-spin text-faint" />}
        </div>
        <div className="min-h-0 flex-1">
          {anteprima ? (
            <iframe src={anteprima} className="h-full w-full border-0" title="Anteprima PDF" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-white/60">
              Generazione dell&apos;anteprima…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

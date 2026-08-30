"use client";

import { useCallback, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATALOGO, configPredefinita, definizione } from "@/lib/workflow/tipi";
import type { Blocco, Collegamento } from "@/lib/workflow/tipi";
import { Input, Select, Campo } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const LARGHEZZA = 190;
const ALTEZZA = 62;

/**
 * Editor a blocchi su tela.
 *
 * I blocchi si trascinano liberamente e si collegano trascinando dalla
 * maniglia destra di uno al corpo di un altro. Le coordinate sono salvate col
 * workflow, così il disegno resta come l'hai lasciato.
 */
export function CanvasWorkflow({
  blocchi,
  setBlocchi,
  collegamenti,
  setCollegamenti,
}: {
  blocchi: Blocco[];
  setBlocchi: (b: Blocco[]) => void;
  collegamenti: Collegamento[];
  setCollegamenti: (c: Collegamento[]) => void;
}) {
  const tela = useRef<HTMLDivElement>(null);
  const [selezionato, setSelezionato] = useState<string | null>(null);
  const [trascinato, setTrascinato] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [collegando, setCollegando] = useState<{ da: string; x: number; y: number } | null>(null);
  const [tavolozza, setTavolozza] = useState(false);

  const blocco = blocchi.find((b) => b.id === selezionato) ?? null;

  const posizioneRelativa = useCallback((e: { clientX: number; clientY: number }) => {
    const r = tela.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, []);

  function aggiungi(tipo: string) {
    const nuovo: Blocco = {
      id: `b${Date.now().toString(36)}`,
      tipo,
      config: configPredefinita(tipo),
      pos: { x: 40 + (blocchi.length % 3) * 220, y: 40 + Math.floor(blocchi.length / 3) * 110 },
    };
    setBlocchi([...blocchi, nuovo]);
    setSelezionato(nuovo.id);
    setTavolozza(false);
  }

  function elimina(id: string) {
    setBlocchi(blocchi.filter((b) => b.id !== id));
    // Un blocco rimosso non deve lasciare collegamenti orfani.
    setCollegamenti(collegamenti.filter((c) => c.da !== id && c.a !== id));
    if (selezionato === id) setSelezionato(null);
  }

  function aggiornaConfig(id: string, chiave: string, valore: string | number) {
    setBlocchi(
      blocchi.map((b) =>
        b.id === id ? { ...b, config: { ...b.config, [chiave]: valore } } : b,
      ),
    );
  }

  function muovi(e: React.MouseEvent) {
    const p = posizioneRelativa(e);
    if (trascinato) {
      setBlocchi(
        blocchi.map((b) =>
          b.id === trascinato.id
            ? { ...b, pos: { x: Math.max(0, p.x - trascinato.dx), y: Math.max(0, p.y - trascinato.dy) } }
            : b,
        ),
      );
    }
    if (collegando) setCollegando({ ...collegando, x: p.x, y: p.y });
  }

  function collega(a: string) {
    if (!collegando || collegando.da === a) return;
    const esiste = collegamenti.some((c) => c.da === collegando.da && c.a === a);
    if (!esiste) setCollegamenti([...collegamenti, { da: collegando.da, a }]);
    setCollegando(null);
  }

  const uscita = (b: Blocco) => ({ x: b.pos.x + LARGHEZZA, y: b.pos.y + ALTEZZA / 2 });

  return (
    <div className="flex min-h-0 flex-1">
      <div
        ref={tela}
        onMouseMove={muovi}
        onMouseUp={() => { setTrascinato(null); setCollegando(null); }}
        onMouseLeave={() => { setTrascinato(null); setCollegando(null); }}
        onClick={() => setSelezionato(null)}
        className="relative min-h-[520px] flex-1 overflow-auto"
        style={{
          background: "var(--bg)",
          backgroundImage: "radial-gradient(circle, var(--border) 1px, transparent 1px)",
          backgroundSize: "18px 18px",
        }}
      >
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {collegamenti.map((c, i) => {
            const da = blocchi.find((b) => b.id === c.da);
            const a = blocchi.find((b) => b.id === c.a);
            if (!da || !a) return null;
            const p1 = uscita(da);
            const p2 = { x: a.pos.x, y: a.pos.y + ALTEZZA / 2 };
            const dx = Math.max(40, Math.abs(p2.x - p1.x) / 2);
            return (
              <path
                key={`${c.da}-${c.a}-${i}`}
                d={`M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`}
                fill="none"
                stroke="var(--border2)"
                strokeWidth="1.5"
              />
            );
          })}
          {collegando &&
            (() => {
              const da = blocchi.find((b) => b.id === collegando.da);
              if (!da) return null;
              const p1 = uscita(da);
              return (
                <path
                  d={`M ${p1.x} ${p1.y} L ${collegando.x} ${collegando.y}`}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              );
            })()}
        </svg>

        {blocchi.map((b) => {
          const d = definizione(b.tipo);
          const attivo = selezionato === b.id;
          return (
            <div
              key={b.id}
              onMouseDown={(e) => {
                e.stopPropagation();
                const p = posizioneRelativa(e);
                setTrascinato({ id: b.id, dx: p.x - b.pos.x, dy: p.y - b.pos.y });
                setSelezionato(b.id);
              }}
              onMouseUp={() => collega(b.id)}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                "absolute cursor-grab select-none rounded-md border bg-surface shadow-[var(--shadow)]",
                attivo ? "border-accent" : "border-border",
              )}
              style={{ left: b.pos.x, top: b.pos.y, width: LARGHEZZA }}
            >
              <div className="flex items-center gap-1.5 px-2 py-1.5">
                <span
                  className="h-2 w-2 flex-none rounded-sm"
                  style={{ background: `var(--tile-${d?.tinta ?? "gray"}-ic)` }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {d?.etichetta ?? b.tipo}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); elimina(b.id); }}
                  className="grid h-4 w-4 place-items-center rounded text-faint hover:text-neg"
                >
                  <X size={11} />
                </button>
              </div>
              <div className="truncate px-2 pb-1.5 text-xxs text-faint">{riassunto(b)}</div>
              <button
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const p = posizioneRelativa(e);
                  setCollegando({ da: b.id, x: p.x, y: p.y });
                }}
                title="Trascina per collegare"
                className="absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-border2 bg-surface hover:border-accent"
              />
            </div>
          );
        })}

        {blocchi.length === 0 && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-faint">
            Aggiungi un blocco per iniziare
          </div>
        )}

        <div className="absolute left-2 top-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); setTavolozza((v) => !v); }}>
            <Plus /> Blocco
          </Button>
          {tavolozza && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="mt-1 max-h-[400px] w-60 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-[var(--shadow)]"
            >
              {(["innesco", "condizione", "azione"] as const).map((cat) => (
                <div key={cat}>
                  <div className="px-2 py-1 text-xxs font-medium uppercase text-faint">
                    {cat === "innesco" ? "Inneschi" : cat === "condizione" ? "Condizioni" : "Azioni"}
                  </div>
                  {CATALOGO.filter((d) => d.categoria === cat).map((d) => (
                    <button
                      key={d.tipo}
                      onClick={() => aggiungi(d.tipo)}
                      className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-surface2"
                    >
                      <span
                        className="h-2 w-2 flex-none rounded-sm"
                        style={{ background: `var(--tile-${d.tinta}-ic)` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs">{d.etichetta}</span>
                        <span className="block truncate text-xxs text-faint">{d.descrizione}</span>
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="w-64 flex-none overflow-y-auto border-l border-border bg-surface">
        {!blocco ? (
          <div className="p-3 text-xs text-faint">Seleziona un blocco per configurarlo.</div>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div>
              <div className="text-xs font-medium">{definizione(blocco.tipo)?.etichetta}</div>
              <div className="mt-0.5 text-xxs text-faint">
                {definizione(blocco.tipo)?.descrizione}
              </div>
            </div>

            {(definizione(blocco.tipo)?.campi ?? []).map((c) => (
              <Campo key={c.chiave} etichetta={c.etichetta} nota={c.nota}>
                {c.tipo === "scelta" ? (
                  <Select
                    value={String(blocco.config[c.chiave] ?? "")}
                    onChange={(e) => aggiornaConfig(blocco.id, c.chiave, e.target.value)}
                  >
                    {(c.opzioni ?? []).map((o) => (
                      <option key={o.valore} value={o.valore}>{o.etichetta}</option>
                    ))}
                  </Select>
                ) : c.tipo === "testolungo" ? (
                  <Textarea
                    rows={3}
                    value={String(blocco.config[c.chiave] ?? "")}
                    onChange={(e) => aggiornaConfig(blocco.id, c.chiave, e.target.value)}
                  />
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
            ))}

            {(definizione(blocco.tipo)?.campi.length ?? 0) === 0 && (
              <div className="text-xxs text-faint">Nessuna opzione da configurare.</div>
            )}

            <div className="text-xxs text-faint">
              Nei testi puoi usare segnaposto come{" "}
              <code className="text-muted">{"{numero}"}</code>,{" "}
              <code className="text-muted">{"{cliente}"}</code>,{" "}
              <code className="text-muted">{"{imponibile}"}</code>.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/** Riga di riepilogo mostrata sotto il titolo del blocco. */
function riassunto(b: Blocco) {
  const c = b.config;
  if (b.tipo === "innesco.evento") return String(c.evento ?? "");
  if (b.tipo === "innesco.pianificato") return String(c.frequenza ?? "");
  if (b.tipo === "condizione.valore") return `${c.campo} ${c.operatore} ${c.soglia}`;
  if (b.tipo === "condizione.giorni") return `${c.giorni} giorni da ${c.campo}`;
  if (b.tipo === "condizione.stato") return `stato = ${c.stato}`;
  if (b.tipo === "azione.notifica") return String(c.titolo || "senza titolo");
  if (b.tipo === "azione.email") return String(c.oggetto || "senza oggetto");
  if (b.tipo === "azione.webhook") return String(c.url ?? "");
  if (b.tipo === "azione.creaAttivita") return String(c.titolo ?? "");
  return definizione(b.tipo)?.descrizione ?? "";
}

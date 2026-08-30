"use client";

import { useOptimistic, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type Colonna = { stato: string; titolo: string };

export type Elemento = {
  id: string;
  stato: string;
  /** Contenuto della card, già formattato dal server component. */
  contenuto: ReactNode;
  /** Titolo usato nei messaggi e nell'etichetta accessibile. */
  etichetta: string;
};

/**
 * Board kanban con trascinamento.
 *
 * Lo spostamento è ottimistico: la card si muove subito e, se il salvataggio
 * fallisce, torna dov'era e viene mostrato l'errore. Ogni card ha anche un
 * menu per spostarsi senza mouse, perché il drag&drop da solo non è
 * raggiungibile da tastiera.
 */
export function Board({
  entita,
  colonne,
  elementi,
}: {
  entita: string;
  colonne: Colonna[];
  elementi: Elemento[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [errore, setErrore] = useState<string | null>(null);
  const [trascinato, setTrascinato] = useState<string | null>(null);
  const [sopra, setSopra] = useState<string | null>(null);

  const [ottimistici, applica] = useOptimistic(
    elementi,
    (stato: Elemento[], m: { id: string; nuovoStato: string }) =>
      stato.map((e) => (e.id === m.id ? { ...e, stato: m.nuovoStato } : e)),
  );

  function sposta(id: string, nuovoStato: string) {
    const elemento = elementi.find((e) => e.id === id);
    if (!elemento || elemento.stato === nuovoStato) return;

    setErrore(null);
    startTransition(async () => {
      applica({ id, nuovoStato });
      const r = await fetch("/api/stato", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entita, id, stato: nuovoStato }),
      }).catch(() => null);

      if (!r || !r.ok) {
        // Il refresh riallinea allo stato reale del server, annullando
        // l'aggiornamento ottimistico.
        setErrore(`Non è stato possibile spostare "${elemento.etichetta}".`);
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {errore && (
        <div className="rounded-md border border-[var(--neg)] bg-[var(--neg-soft)] px-3 py-2 text-md text-neg">
          {errore}
        </div>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {colonne.map((col) => {
          const items = ottimistici.filter((e) => e.stato === col.stato);
          return (
            <div
              key={col.stato}
              onDragOver={(ev) => {
                ev.preventDefault();
                setSopra(col.stato);
              }}
              onDragLeave={() => setSopra((s) => (s === col.stato ? null : s))}
              onDrop={(ev) => {
                ev.preventDefault();
                setSopra(null);
                if (trascinato) sposta(trascinato, col.stato);
                setTrascinato(null);
              }}
              className={cn(
                "flex min-w-[264px] flex-1 flex-col gap-2 rounded-md p-1 transition-colors",
                sopra === col.stato && "tl-dropzone",
              )}
            >
              <div className="flex items-center gap-2 px-1.5 py-1">
                <span className="text-md font-medium text-text">
                  {col.titolo}
                </span>
                <span className="rounded bg-surface2 px-1.5 text-xs text-faint">
                  {items.length}
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                {items.map((e) => (
                  <CardTrascinabile
                    key={e.id}
                    elemento={e}
                    colonne={colonne}
                    inTrascinamento={trascinato === e.id}
                    onDragStart={() => setTrascinato(e.id)}
                    onDragEnd={() => {
                      setTrascinato(null);
                      setSopra(null);
                    }}
                    onSposta={(s) => sposta(e.id, s)}
                  />
                ))}
                {items.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-md text-faint">
                    Trascina qui
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CardTrascinabile({
  elemento,
  colonne,
  inTrascinamento,
  onDragStart,
  onDragEnd,
  onSposta,
}: {
  elemento: Elemento;
  colonne: Colonna[];
  inTrascinamento: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onSposta: (stato: string) => void;
}) {
  const [menu, setMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={(ev) => {
        ev.dataTransfer.effectAllowed = "move";
        // Firefox avvia il drag solo se il dataTransfer contiene qualcosa.
        ev.dataTransfer.setData("text/plain", elemento.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative cursor-grab rounded-md border border-border bg-surface p-2.5 transition-colors hover:border-border2",
        inTrascinamento && "tl-dragging",
      )}
    >
      <div className="pr-6">{elemento.contenuto}</div>

      <button
        onClick={() => setMenu((m) => !m)}
        aria-label={`Sposta ${elemento.etichetta}`}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded text-faint opacity-0 transition-opacity hover:bg-surface2 hover:text-text focus:opacity-100 group-hover:opacity-100"
      >
        <MoreHorizontal size={14} />
      </button>

      {menu && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
          <div className="absolute right-1.5 top-8 z-20 w-44 overflow-hidden rounded-md border border-border bg-surface py-1 shadow-[var(--shadow)]">
            <div className="px-2.5 py-1 text-xs text-faint">Sposta in</div>
            {colonne
              .filter((c) => c.stato !== elemento.stato)
              .map((c) => (
                <button
                  key={c.stato}
                  onClick={() => {
                    setMenu(false);
                    onSposta(c.stato);
                  }}
                  className="w-full px-2.5 py-1.5 text-left text-md text-muted transition-colors hover:bg-surface2 hover:text-text"
                >
                  {c.titolo}
                </button>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

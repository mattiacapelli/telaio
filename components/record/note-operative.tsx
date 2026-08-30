"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { dataEstesa } from "@/lib/format";

type Nota = {
  id: string;
  testo: string;
  autore: string | null;
  createdAt: Date | string;
};

/** Note su un'attività o un ticket: stessa forma, endpoint diverso. */
export function NoteOperative({
  entita,
  id,
  note,
}: {
  entita: "attivita" | "ticket";
  id: string;
  note: Nota[];
}) {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim()) return;
    setInCorso(true);
    const r = await fetch(`/api/${entita}/${id}/note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ testo }),
    }).catch(() => null);
    setInCorso(false);
    if (r?.ok) {
      setTesto("");
      router.refresh();
    }
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      <form onSubmit={aggiungi} className="flex flex-col gap-1.5">
        <textarea
          value={testo}
          onChange={(e) => setTesto(e.target.value)}
          rows={2}
          placeholder="Annota un aggiornamento…"
          className="w-full resize-y rounded border border-border bg-surface2 px-2 py-1.5 text-xs outline-none placeholder:text-faint focus:border-accent-line focus:ring-1 focus:ring-accent-line"
        />
        <div className="flex">
          <div className="flex-1" />
          <Button type="submit" size="sm" disabled={inCorso || !testo.trim()}>
            {inCorso ? "Salvo…" : "Aggiungi nota"}
          </Button>
        </div>
      </form>

      {note.length === 0 ? (
        <div className="py-3 text-center text-xxs text-faint">Nessuna nota</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {note.map((nt) => (
            <div key={nt.id} className="rounded border border-border bg-surface2 px-2 py-1.5">
              <div className="whitespace-pre-wrap text-xs">{nt.testo}</div>
              <div className="mt-1 text-xxs text-faint">
                {dataEstesa(nt.createdAt)}
                {nt.autore && ` · ${nt.autore}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

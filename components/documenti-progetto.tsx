"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, Trash2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dataEstesa } from "@/lib/format";

type Documento = {
  id: string;
  nome: string;
  tipo: string;
  dimensione: number;
  caricatoDa: string | null;
  createdAt: Date | string;
};

function pesoLeggibile(byte: number) {
  if (byte < 1024) return `${byte} B`;
  if (byte < 1024 * 1024) return `${(byte / 1024).toFixed(0)} KB`;
  return `${(byte / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Allegati di un record.
 *
 * Stesso componente per progetti, ticket, contratti, prodotti, clienti e
 * preventivi: cambia solo l'endpoint, perché il modello Documento è
 * condiviso.
 */
export function DocumentiProgetto({
  progettoId,
  entita = "progetti",
  documenti,
}: {
  progettoId: string;
  entita?: "progetti" | "ticket" | "contratti" | "prodotti" | "clienti" | "preventivi";
  documenti: Documento[];
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [sopra, setSopra] = useState(false);

  async function carica(file: File) {
    setErrore(null);
    setInCorso(true);
    const corpo = new FormData();
    corpo.append("file", file);

    const r = await fetch(`/api/${entita}/${progettoId}/documenti`, {
      method: "POST",
      body: corpo,
    }).catch(() => null);

    setInCorso(false);
    if (!r || !r.ok) {
      const d = await r?.json().catch(() => null);
      setErrore(d?.errore ?? "Caricamento non riuscito");
      return;
    }
    router.refresh();
  }

  async function elimina(id: string, nome: string) {
    if (!confirm(`Eliminare "${nome}"? L'operazione non è reversibile.`)) return;
    const r = await fetch(`/api/documenti/${id}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) {
      setErrore("Eliminazione non riuscita");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2 p-2">
      {/* Area di rilascio: trascinare un file è il gesto più naturale qui. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSopra(true);
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSopra(false);
          const f = e.dataTransfer.files?.[0];
          if (f) carica(f);
        }}
        onClick={() => input.current?.click()}
        className={`flex cursor-pointer flex-col items-center gap-1 rounded border border-dashed px-3 py-4 text-center transition-colors ${
          sopra ? "border-accent bg-accent-soft" : "border-border2 hover:bg-[var(--alpha-lighter)]"
        }`}
      >
        <Upload size={16} className="text-faint" />
        <div className="text-md text-muted">
          {inCorso ? "Carico…" : "Trascina un file o clicca per sceglierlo"}
        </div>
        <div className="text-xs text-faint">Massimo 25 MB</div>
      </div>
      <input
        ref={input}
        type="file"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) carica(f);
          e.target.value = "";
        }}
      />

      {errore && (
        <div className="rounded border border-[var(--neg)] bg-[var(--neg-soft)] px-2 py-1.5 text-md text-neg">
          {errore}
        </div>
      )}

      {documenti.length === 0 ? (
        <div className="py-3 text-center text-xs text-faint">
          Nessun documento allegato
        </div>
      ) : (
        <div className="flex flex-col">
          {documenti.map((d) => (
            <div
              key={d.id}
              className="group flex items-center gap-2 border-b border-border py-1.5 last:border-0"
            >
              <FileText size={14} className="flex-none text-faint" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-md">{d.nome}</div>
                <div className="text-xs text-faint">
                  {pesoLeggibile(d.dimensione)} · {dataEstesa(d.createdAt)}
                  {d.caricatoDa && ` · ${d.caricatoDa}`}
                </div>
              </div>
              <a
                href={`/api/documenti/${d.id}`}
                title="Scarica"
                className="grid h-6 w-6 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text"
              >
                <Download size={13} />
              </a>
              <button
                onClick={() => elimina(d.id, d.nome)}
                title="Elimina"
                className="grid h-6 w-6 flex-none place-items-center rounded text-faint opacity-0 transition-all hover:bg-surface2 hover:text-neg group-hover:opacity-100"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function NoteProgetto({
  progettoId,
  note,
}: {
  progettoId: string;
  note: { id: string; testo: string; autore: string | null; createdAt: Date | string }[];
}) {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [inCorso, setInCorso] = useState(false);

  async function aggiungi(e: React.FormEvent) {
    e.preventDefault();
    if (!testo.trim()) return;
    setInCorso(true);
    const r = await fetch(`/api/progetti/${progettoId}/note`, {
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
          placeholder="Annota una decisione, una promessa fatta al cliente…"
          className="w-full resize-y rounded border border-border bg-surface2 px-2 py-1.5 text-md outline-none placeholder:text-faint focus:border-accent-line focus:ring-1 focus:ring-accent-line"
        />
        <div className="flex">
          <div className="flex-1" />
          <Button type="submit" size="sm" disabled={inCorso || !testo.trim()}>
            {inCorso ? "Salvo…" : "Aggiungi nota"}
          </Button>
        </div>
      </form>

      {note.length === 0 ? (
        <div className="py-3 text-center text-xs text-faint">Nessuna nota</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {note.map((nt) => (
            <div key={nt.id} className="rounded border border-border bg-surface2 px-2 py-1.5">
              <div className="whitespace-pre-wrap text-md">{nt.testo}</div>
              <div className="mt-1 text-xs text-faint">
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

"use client";

import { formattaDimensione } from "@telaio/core";
import { FileText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { collegaDocumentiAction } from "@/app/(app)/allegati-actions";
import { Button } from "@/components/ui/button";
import { Checkbox, SearchInput } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { formatData } from "@/lib/date";
import { campiDestinazione, type Destinazione } from "./allegati-destinazione";

interface FileArchivio {
  id: string;
  nome: string;
  dimensioneByte: number;
  createdAt: string;
  origine: string;
}

/**
 * Allega file che sono già nell'archivio (caricati per un altro progetto, preventivo o cliente):
 * non si ricaricano né si copiano, l'allegato punta allo stesso oggetto.
 */
export function ScegliDaArchivio({ destinazione }: { destinazione: Destinazione }) {
  const router = useRouter();
  const [testo, setTesto] = useState("");
  const [file, setFile] = useState<FileArchivio[] | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [scelti, setScelti] = useState<Set<string>>(new Set());
  const [versione, setVersione] = useState(0);
  const [inCorso, avvia] = useTransition();

  useEffect(() => {
    const ac = new AbortController();
    const t = setTimeout(
      async () => {
        try {
          const r = await fetch(`/api/archivio?q=${encodeURIComponent(testo)}`, {
            signal: ac.signal,
          });
          if (!r.ok) throw new Error();
          setFile(await r.json());
          setErrore(null);
        } catch (e) {
          if ((e as Error).name !== "AbortError") setErrore("Impossibile leggere l'archivio");
        }
      },
      testo ? 250 : 0,
    );
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [testo, versione]);

  function allega() {
    const dati = campiDestinazione(destinazione, new FormData());
    for (const id of scelti) dati.append("documentoIds", id);
    avvia(async () => {
      const esito = await collegaDocumentiAction({ ok: false }, dati);
      if (!esito.ok) {
        setErrore(esito.message ?? "Allegato non riuscito");
        return;
      }
      toast(esito.message ?? "File allegati");
      setScelti(new Set());
      setErrore(null);
      setVersione((v) => v + 1);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        aria-label="Cerca nell'archivio"
        placeholder="Cerca un file per nome"
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
      />
      {file === null ? (
        <p className="text-sm text-fg-2">Caricamento…</p>
      ) : file.length === 0 ? (
        <p className="text-sm text-fg-2">
          {testo ? "Nessun file con questo nome." : "L'archivio è vuoto: carica prima un file."}
        </p>
      ) : (
        <ul className="max-h-72 divide-y divide-line overflow-y-auto rounded-md border border-line text-sm">
          {file.map((f) => (
            <li key={f.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-hover">
                <Checkbox
                  aria-label={`Scegli ${f.nome}`}
                  checked={scelti.has(f.id)}
                  onChange={(e) =>
                    setScelti((att) => {
                      const n = new Set(att);
                      if (e.target.checked) n.add(f.id);
                      else n.delete(f.id);
                      return n;
                    })
                  }
                />
                <FileText className="size-4 shrink-0 text-fg-3" aria-hidden />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium">{f.nome}</span>
                  <span className="truncate text-xs text-fg-3">
                    {f.origine} · {formattaDimensione(f.dimensioneByte)} · {formatData(f.createdAt)}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {errore && (
        <p role="alert" className="text-sm text-bad">
          {errore}
        </p>
      )}
      <div className="flex justify-end">
        <Button type="button" onClick={allega} disabled={inCorso || scelti.size === 0}>
          {inCorso
            ? "Allego…"
            : scelti.size === 0
              ? "Allega i file scelti"
              : `Allega ${scelti.size === 1 ? "il file" : `${scelti.size} file`}`}
        </Button>
      </div>
    </div>
  );
}

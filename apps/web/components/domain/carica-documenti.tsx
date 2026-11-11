"use client";

import {
  CATEGORIE_DOCUMENTO,
  ETICHETTE_CATEGORIA_DOCUMENTO,
  formattaDimensione,
  LIMITE_FILE_BYTE,
} from "@telaio/core";
import { FileUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { type Destinazione, indirizzoCaricamento } from "./allegati-destinazione";

interface Esito {
  caricati: { id: string; nome: string }[];
  errori: { nome: string; errore: string }[];
  errore?: string;
}

/** Carica file nell'archivio e li allega alla destinazione: scelta o trascinamento, con avanzamento. */
export function CaricaDocumenti({
  destinazione,
  configurato,
}: {
  destinazione: Destinazione;
  configurato: boolean;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File[]>([]);
  const [categoria, setCategoria] = useState("altro");
  const [descrizione, setDescrizione] = useState("");
  const [sopra, setSopra] = useState(false);
  const [avanzamento, setAvanzamento] = useState<number | null>(null);
  const [errori, setErrori] = useState<string[]>([]);

  if (!configurato)
    return (
      <p className="rounded-md border border-warn/30 bg-warn-soft px-3 py-2 text-sm text-warn">
        L&apos;archivio dei documenti non è configurato.{" "}
        <Link
          href="/impostazioni/archiviazione"
          className="font-medium underline underline-offset-2"
        >
          Indica il bucket S3
        </Link>{" "}
        per poter caricare file.
      </p>
    );

  const aggiungi = (nuovi: File[]) => {
    setErrori([]);
    setFile((att) => [
      ...att,
      ...nuovi.filter((n) => !att.some((a) => a.name === n.name && a.size === n.size)),
    ]);
  };
  const troppoGrandi = file.filter((f) => f.size > LIMITE_FILE_BYTE);

  function invia() {
    const dati = new FormData();
    for (const f of file) dati.append("file", f);
    dati.set("categoria", categoria);
    dati.set("descrizione", descrizione);
    if ("ticketId" in destinazione && destinazione.ticketId)
      dati.set("ticketId", destinazione.ticketId);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", indirizzoCaricamento(destinazione));
    xhr.upload.onprogress = (e) =>
      e.lengthComputable && setAvanzamento(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => {
      setAvanzamento(null);
      setErrori(["Connessione interrotta durante il caricamento"]);
    };
    xhr.onload = () => {
      setAvanzamento(null);
      let esito: Esito = { caricati: [], errori: [] };
      try {
        esito = JSON.parse(xhr.responseText);
      } catch {
        esito.errore = "Risposta non valida dal server";
      }
      const problemi = [
        ...(esito.errore ? [esito.errore] : []),
        ...esito.errori.map((e) => `${e.nome}: ${e.errore}`),
      ];
      if (esito.caricati.length) {
        toast(
          esito.caricati.length === 1
            ? "Documento caricato"
            : `${esito.caricati.length} documenti caricati`,
        );
        router.refresh();
      }
      setErrori(problemi);
      // restano in elenco solo i file che non sono andati a buon fine
      const falliti = new Set(esito.errori.map((e) => e.nome));
      setFile((att) => (problemi.length ? att.filter((f) => falliti.has(f.name)) : []));
      if (!problemi.length) setDescrizione("");
    };
    setAvanzamento(0);
    xhr.send(dati);
  }

  const inCorso = avanzamento !== null;
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => campo.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setSopra(true);
        }}
        onDragLeave={() => setSopra(false)}
        onDrop={(e) => {
          e.preventDefault();
          setSopra(false);
          aggiungi([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center text-sm transition-colors duration-150",
          sopra ? "border-brand bg-brand/5 text-fg" : "border-line-strong text-fg-2 hover:bg-hover",
        )}
      >
        <FileUp className="size-5 text-fg-3" aria-hidden />
        <span>
          <span className="font-medium text-fg">Scegli i file</span> o trascinali qui
        </span>
        <span className="text-xs text-fg-3">
          Fino a {LIMITE_FILE_BYTE / 1024 / 1024} MB ciascuno, 10 per volta
        </span>
      </button>
      <input
        ref={campo}
        type="file"
        multiple
        className="sr-only"
        aria-label="File da caricare"
        onChange={(e) => {
          aggiungi([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />

      {file.length > 0 && (
        <>
          <ul className="divide-y divide-line rounded-md border border-line text-sm">
            {file.map((f) => (
              <li key={`${f.name}-${f.size}`} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate">{f.name}</span>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    f.size > LIMITE_FILE_BYTE ? "text-bad" : "text-fg-3",
                  )}
                >
                  {formattaDimensione(f.size)}
                </span>
                <IconButton
                  label={`Togli ${f.name}`}
                  disabled={inCorso}
                  onClick={() => setFile((att) => att.filter((x) => x !== f))}
                >
                  <X />
                </IconButton>
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
            <Select
              aria-label="Categoria"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
            >
              {CATEGORIE_DOCUMENTO.map((c) => (
                <option key={c} value={c}>
                  {ETICHETTE_CATEGORIA_DOCUMENTO[c]}
                </option>
              ))}
            </Select>
            <Input
              aria-label="Descrizione"
              placeholder="Descrizione (facoltativa)"
              maxLength={500}
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
            />
          </div>
          {inCorso && (
            <div
              role="progressbar"
              aria-valuenow={avanzamento}
              aria-valuemin={0}
              aria-valuemax={100}
              className="h-1.5 overflow-hidden rounded-full bg-line"
            >
              <div
                className="h-full bg-brand transition-[width] duration-150"
                style={{ width: `${avanzamento}%` }}
              />
            </div>
          )}
          <div className="flex justify-end">
            <Button type="button" onClick={invia} disabled={inCorso || troppoGrandi.length > 0}>
              {inCorso
                ? `Caricamento… ${avanzamento}%`
                : `Carica ${file.length === 1 ? "il file" : `${file.length} file`}`}
            </Button>
          </div>
        </>
      )}
      {troppoGrandi.length > 0 && (
        <p role="alert" className="text-sm text-bad">
          Togli i file sopra il limite di {LIMITE_FILE_BYTE / 1024 / 1024} MB.
        </p>
      )}
      {errori.length > 0 && (
        <ul
          role="alert"
          className="rounded-md border border-bad/20 bg-bad-soft px-3 py-2 text-sm text-bad"
        >
          {errori.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

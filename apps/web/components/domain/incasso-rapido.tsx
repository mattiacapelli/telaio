"use client";

import { formatEuro } from "@telaio/core";
import { Check, Delete, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { registraIncassoAction } from "@/app/(app)/incassi/actions";
import { Button, IconButton } from "@/components/ui/button";
import { initialState } from "@/components/ui/form-modal";
import { oggi } from "@/lib/date";
import { cn } from "@/lib/utils";

interface Conto {
  id: string;
  nome: string;
  tipo: "bonifico" | "contante" | "carta";
  ragioneSocialeId: string | null;
}
interface Rata {
  id: string;
  clienteId: string;
  descrizione: string;
  importoCent: number;
  scaduta: boolean;
  ragioneSocialeId: string;
}

const METODI = [
  ["contante", "Contante"],
  ["bonifico", "Bonifico"],
  ["carta", "Carta"],
] as const;
const TASTI = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ",", "0", "⌫"];

/** Registrazione rapida di un incasso da telefono: tastierino, metodo, rata opzionale. */
export function IncassoRapido({
  conti,
  clienti,
  rate,
}: {
  conti: Conto[];
  clienti: { id: string; nome: string }[];
  rate: Rata[];
}) {
  const [clienteId, setClienteId] = useState<string | null>(clienti[0]?.id ?? null);
  const [rataId, setRataId] = useState<string | null>(null);
  const [testo, setTesto] = useState("");
  const [metodo, setMetodo] = useState<(typeof METODI)[number][0]>("contante");
  const [errore, setErrore] = useState<string | null>(null);
  const [fatto, setFatto] = useState<{ importo: string; conto: string } | null>(null);
  const [pending, avvia] = useTransition();

  const proposta = rate.find((r) => r.clienteId === clienteId);
  const rata = rate.find((r) => r.id === rataId);
  const conto =
    conti.find(
      (c) =>
        c.tipo === metodo &&
        (!rata || !c.ragioneSocialeId || c.ragioneSocialeId === rata.ragioneSocialeId),
    ) ?? conti.find((c) => c.tipo === metodo);
  const importo =
    testo === ""
      ? "0,00"
      : testo.includes(",")
        ? testo.padEnd(testo.indexOf(",") + 3, "0")
        : `${testo},00`;

  function premi(k: string) {
    setErrore(null);
    if (k === "⌫") return setTesto((t) => t.slice(0, -1));
    if (k === ",") return setTesto((t) => (t.includes(",") ? t : `${t || "0"},`));
    setTesto((t) => {
      const [, dec] = t.split(",");
      if (dec !== undefined && dec.length >= 2) return t;
      return t === "0" ? k : t + k;
    });
  }

  function conferma() {
    if (!conto) return setErrore("Nessun conto di questo tipo");
    const fd = new FormData();
    fd.set("contoId", conto.id);
    fd.set("data", oggi());
    fd.set("importo", importo);
    if (rataId) fd.set("rataId", rataId);
    avvia(async () => {
      const r = await registraIncassoAction(initialState, fd);
      if (r.ok) setFatto({ importo, conto: conto.nome });
      else setErrore(r.errors?.importo ?? r.message ?? "Registrazione non riuscita");
    });
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-md flex-col gap-3 overflow-hidden bg-surface px-4 pt-5 pb-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-col leading-tight">
          <span className="text-xs text-fg-3">Incasso al volo</span>
          <span className="text-xl font-semibold tracking-tight">Nuovo incasso</span>
        </div>
        <IconButton label="Chiudi" variant="secondary" asChild>
          <Link href="/incassi">
            <X />
          </Link>
        </IconButton>
      </div>

      {clienti.length > 0 && (
        <div
          role="radiogroup"
          aria-label="Cliente"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-0.5"
        >
          {clienti.map((c) => (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={c.id === clienteId}
              className={cn(
                "h-8 shrink-0 cursor-pointer rounded-md border px-3 text-sm whitespace-nowrap transition-colors duration-150",
                c.id === clienteId
                  ? "border-transparent bg-fg text-on-fg"
                  : "border-line bg-surface text-fg-2",
              )}
              onClick={() => {
                setClienteId(c.id);
                setRataId(null);
              }}
            >
              {c.nome}
            </button>
          ))}
        </div>
      )}

      {proposta && (
        <div className="flex items-center gap-3 rounded-lg border border-line bg-subtle p-3">
          <div className="flex flex-1 flex-col leading-tight">
            <span className="text-sm font-medium">
              {proposta.descrizione}
              {proposta.scaduta ? " · scaduta" : ""}
            </span>
            <span className="text-xs text-fg-2 tabular-nums">
              {formatEuro(proposta.importoCent)}
            </span>
          </div>
          <Button
            type="button"
            size="sm"
            variant={rataId === proposta.id ? "secondary" : "primary"}
            onClick={() => {
              setRataId(proposta.id);
              setTesto(
                formatEuro(proposta.importoCent)
                  .replace(/[^\d,]/g, "")
                  .replace(/,00$/, ""),
              );
            }}
          >
            {rataId === proposta.id ? "In uso" : "Usa"}
          </Button>
        </div>
      )}

      <div className="flex flex-col items-center gap-1 py-2">
        <span className="text-5xl font-semibold tracking-tight tabular-nums">€ {importo}</span>
        <span className="text-sm text-fg-2">
          {rata ? `Chiude: ${rata.descrizione}` : "Digita l'importo ricevuto"}
        </span>
      </div>

      <div
        role="radiogroup"
        aria-label="Metodo"
        className="flex gap-0.5 rounded-md border border-line bg-subtle p-0.5"
      >
        {METODI.map(([id, l]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={metodo === id}
            className={cn(
              "h-9 flex-1 cursor-pointer rounded-sm text-sm font-medium transition-colors duration-150",
              metodo === id ? "bg-surface text-fg shadow-xs" : "text-fg-2",
            )}
            onClick={() => setMetodo(id)}
          >
            {l}
          </button>
        ))}
      </div>
      <span className="text-center text-sm text-fg-2">
        Va su <b className="font-medium text-fg">{conto?.nome ?? "—"}</b>
      </span>

      <div className="mt-auto grid grid-cols-3 gap-2">
        {TASTI.map((k) => (
          <button
            key={k}
            type="button"
            aria-label={k === "⌫" ? "Cancella" : k}
            onClick={() => premi(k)}
            className="grid h-14 cursor-pointer place-items-center rounded-lg border border-line bg-surface text-xl font-medium transition-colors duration-100 active:bg-hover"
          >
            {k === "⌫" ? <Delete className="size-5" aria-hidden /> : k}
          </button>
        ))}
      </div>
      {errore && (
        <p role="alert" className="text-center text-sm font-medium text-bad">
          {errore}
        </p>
      )}
      <Button
        type="button"
        onClick={conferma}
        disabled={pending || importo === "0,00"}
        className="h-12 w-full text-base"
      >
        {pending ? "Registro…" : `Registra € ${importo}`}
      </Button>

      {fatto && (
        <div
          role="status"
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface p-8 text-center"
        >
          <span className="grid size-14 place-items-center rounded-full bg-ok-soft text-ok">
            <Check className="size-7" aria-hidden />
          </span>
          <span className="text-3xl font-semibold tracking-tight tabular-nums">
            € {fatto.importo}
          </span>
          <span className="text-sm text-fg-2">Registrato su {fatto.conto}</span>
          <Button
            type="button"
            className="mt-3"
            onClick={() => {
              setFatto(null);
              setTesto("");
              setRataId(null);
            }}
          >
            Nuovo incasso
          </Button>
          <Link href="/incassi" className="text-sm text-fg-2 underline underline-offset-4">
            Vai agli incassi
          </Link>
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Il campo Titolo del contratto raddoppia da selettore prodotti: le pill dei
 * prodotti scelti restano agganciate al testo, con un autocomplete che
 * filtra il catalogo mentre si scrive. Evita una lista di checkbox separata
 * per un'azione che capita quasi sempre insieme alla scelta del titolo.
 *
 * Il testo digitato è ambiguo tra "sto cercando un prodotto" e "sto
 * scrivendo il titolo": si risolve trattandolo da ricerca finché il campo
 * resta attivo (ogni prodotto scelto lo svuota per la ricerca successiva),
 * e da titolo vero nel momento in cui il campo perde il focus — da lì in
 * poi digitare non riapre più l'autocomplete, è editing del titolo.
 */
export function TitoloConProdotti({
  titolo,
  onTitoloChange,
  prodotti,
  selezionati,
  onSelezionatiChange,
}: {
  titolo: string;
  onTitoloChange: (v: string) => void;
  prodotti: { id: string; nome: string }[];
  selezionati: string[];
  onSelezionatiChange: (ids: string[]) => void;
}) {
  const [ricercaAttiva, setRicercaAttiva] = useState(true);
  const [aperto, setAperto] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const disponibili = prodotti.filter((p) => !selezionati.includes(p.id));
  const suggeriti =
    ricercaAttiva && titolo.trim()
      ? disponibili.filter((p) => p.nome.toLowerCase().includes(titolo.trim().toLowerCase()))
      : disponibili;

  function aggiungi(id: string) {
    onSelezionatiChange([...selezionati, id]);
    onTitoloChange("");
    setAperto(false);
    inputRef.current?.focus();
  }

  function rimuovi(id: string) {
    onSelezionatiChange(selezionati.filter((x) => x !== id));
  }

  return (
    <div className="relative">
      <div
        className="flex min-h-[32px] w-full flex-wrap items-center gap-1 rounded border border-border bg-surface2 px-1.5 py-1 focus-within:border-accent-line focus-within:ring-1 focus-within:ring-accent-line"
        onClick={() => inputRef.current?.focus()}
      >
        {selezionati.map((id) => {
          const p = prodotti.find((x) => x.id === id);
          if (!p) return null;
          return (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-[4px] border border-accent-line bg-accent-soft px-1.5 py-0.5 text-xs font-medium text-accent"
            >
              {p.nome}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  rimuovi(id);
                }}
                className="grid h-3 w-3 place-items-center rounded-full hover:bg-[var(--alpha-light)]"
              >
                <X size={9} />
              </button>
            </span>
          );
        })}
        <input
          ref={inputRef}
          value={titolo}
          onChange={(e) => {
            onTitoloChange(e.target.value);
            if (ricercaAttiva) setAperto(true);
          }}
          onFocus={() => {
            if (ricercaAttiva) setAperto(true);
          }}
          onBlur={() => {
            // Da qui in poi il testo è il titolo: la ricerca non si riapre
            // più, anche se l'utente torna a modificarlo.
            setRicercaAttiva(false);
            setTimeout(() => setAperto(false), 150);
          }}
          placeholder={selezionati.length > 0 ? "Titolo del contratto" : "Es. Assistenza sistemistica 2026"}
          className="h-[24px] min-w-[120px] flex-1 bg-transparent text-sm text-text outline-none placeholder:text-faint"
        />
      </div>

      {ricercaAttiva && aperto && prodotti.length > 0 && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border bg-surface shadow-[var(--shadow)]">
          {suggeriti.length === 0 ? (
            <div className="px-2 py-1.5 text-md text-faint">Nessun prodotto</div>
          ) : (
            suggeriti.map((p) => (
              <button
                key={p.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  aggiungi(p.id);
                }}
                className={cn(
                  "block w-full px-2 py-1.5 text-left text-md text-text hover:bg-[var(--alpha-lighter)]",
                )}
              >
                {p.nome}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

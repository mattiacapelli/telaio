"use client";

import { punteggioRicerca } from "@telaio/core";
import { Command } from "cmdk";
import {
  CornerDownLeft,
  FileText,
  FolderOpen,
  type LucideIcon,
  Receipt,
  Repeat,
  Search,
  Tag,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { impostaTema } from "@/lib/tema";
import { cn } from "@/lib/utils";
import { FUNZIONI, type Funzione, GRUPPI_FUNZIONI } from "./ricerca-voci";

const EVENTO = "telaio:palette";
export const openPalette = () => window.dispatchEvent(new Event(EVENTO));

type TipoRisultato = "cliente" | "preventivo" | "fattura" | "progetto" | "abbonamento" | "listino";

interface Risultato {
  tipo: TipoRisultato;
  titolo: string;
  sottotitolo?: string;
  href: string;
}

const TIPI: Record<TipoRisultato, { titolo: string; icona: LucideIcon }> = {
  cliente: { titolo: "Clienti", icona: Users },
  preventivo: { titolo: "Preventivi", icona: FileText },
  fattura: { titolo: "Fatture", icona: Receipt },
  progetto: { titolo: "Progetti", icona: FolderOpen },
  abbonamento: { titolo: "Abbonamenti", icona: Repeat },
  listino: { titolo: "Listini", icona: Tag },
};

/** Quante funzioni mostrare per gruppo mentre si digita (a campo vuoto, tutte). */
const MAX_FUNZIONI = 5;

const STILE_GRUPPO =
  "[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3";
const STILE_VOCE =
  "group flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2.5 py-1.5 data-[selected=true]:bg-hover md:min-h-10";

function Voce({
  value,
  icona: Icona,
  titolo,
  sottotitolo,
  etichetta,
  onSelect,
}: {
  value: string;
  icona: LucideIcon;
  titolo: string;
  sottotitolo?: string;
  etichetta?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={STILE_VOCE}>
      <span
        aria-hidden
        className="grid size-7 flex-none place-items-center rounded-md border border-line bg-subtle text-fg-2"
      >
        <Icona className="size-4" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col leading-tight">
        <span className="truncate text-sm text-fg">{titolo}</span>
        {sottotitolo && <span className="truncate text-xs text-fg-3">{sottotitolo}</span>}
      </span>
      {etichetta && <span className="flex-none text-xs text-fg-3">{etichetta}</span>}
      <CornerDownLeft
        aria-hidden
        className="hidden size-3.5 flex-none text-fg-3 group-data-[selected=true]:block"
      />
    </Command.Item>
  );
}

/**
 * Ricerca universale (⌘K / Ctrl+K): trova i contenuti (clienti, preventivi, fatture, progetti,
 * abbonamenti, listini) e le funzioni (azioni, pagine, impostazioni, tema) con la stessa barra.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [risultati, setRisultati] = useState<Risultato[]>([]);
  const [cerco, setCerco] = useState(false);
  const cercata = query.trim().length >= 2;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(EVENTO, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(EVENTO, onOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setRisultati([]);
    }
  }, [open]);

  useEffect(() => {
    if (!cercata) {
      setRisultati([]);
      setCerco(false);
      return;
    }
    setCerco(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ricerca?q=${encodeURIComponent(query.trim())}`, {
          signal: ctrl.signal,
        });
        setRisultati(res.ok ? await res.json() : []);
        setCerco(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setCerco(false);
      }
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, cercata]);

  /** Le funzioni che corrispondono, migliori prima; a campo vuoto, tutte nell'ordine del menu. */
  const funzioni = useMemo(() => {
    const q = query.trim();
    const perGruppo = new Map<string, { f: Funzione; punti: number }[]>();
    for (const f of FUNZIONI) {
      const punti = q ? punteggioRicerca(q, f) : 1;
      if (punti <= 0) continue;
      perGruppo.set(f.gruppo, [...(perGruppo.get(f.gruppo) ?? []), { f, punti }]);
    }
    return GRUPPI_FUNZIONI.flatMap((g) => {
      const voci = perGruppo.get(g);
      if (!voci) return [];
      const ordinate = q ? [...voci].sort((a, b) => b.punti - a.punti) : voci;
      return [
        {
          gruppo: g,
          voci: (q ? ordinate.slice(0, MAX_FUNZIONI) : ordinate).map((v) => v.f),
          migliore: ordinate[0]?.punti ?? 0,
        },
      ];
    });
  }, [query]);

  const contenuti = useMemo(() => {
    const perTipo = new Map<TipoRisultato, Risultato[]>();
    for (const r of risultati) perTipo.set(r.tipo, [...(perTipo.get(r.tipo) ?? []), r]);
    return [...perTipo.entries()];
  }, [risultati]);

  // Un comando che inizia come ciò che scrivi («nuova fatt…») sta sopra i contenuti; altrimenti sotto.
  const funzioniPrima = !cercata || funzioni.some((g) => g.migliore >= 100);

  const valoreContenuto = (r: Risultato) => `${r.tipo}-${r.href}-${r.titolo}`.toLowerCase();
  // Con il filtro di cmdk spento la selezione non si sposta da sola: la prima voce la scelgo io,
  // così Invio apre sempre qualcosa.
  const primaVoce = useMemo(() => {
    const f = funzioni[0]?.voci[0]?.id;
    const c = contenuti[0]?.[1][0];
    return (
      (funzioniPrima ? (f ?? (c && valoreContenuto(c))) : ((c && valoreContenuto(c)) ?? f)) ?? ""
    ).toLowerCase();
  }, [funzioni, contenuti, funzioniPrima]);
  const [selezionata, setSelezionata] = useState("");
  useEffect(() => setSelezionata(primaVoce), [primaVoce, query, risultati]);

  function vai(href: string) {
    setOpen(false);
    router.push(href);
  }
  function esegui(f: Funzione) {
    if (f.tema) {
      impostaTema(f.tema);
      return setOpen(false);
    }
    if (f.href) vai(f.href);
  }

  const gruppiFunzioni = funzioni.map(({ gruppo, voci }) => (
    <Command.Group key={gruppo} heading={gruppo} className={STILE_GRUPPO}>
      {voci.map((f) => (
        <Voce
          key={f.id}
          value={f.id.toLowerCase()}
          icona={f.icona}
          titolo={f.titolo}
          sottotitolo={f.sottotitolo}
          onSelect={() => esegui(f)}
        />
      ))}
    </Command.Group>
  ));
  const gruppiContenuti = contenuti.map(([tipo, voci]) => (
    <Command.Group key={tipo} heading={TIPI[tipo].titolo} className={STILE_GRUPPO}>
      {voci.map((r) => (
        <Voce
          key={`${r.tipo}-${r.href}-${r.titolo}`}
          value={valoreContenuto(r)}
          icona={TIPI[tipo].icona}
          titolo={r.titolo}
          sottotitolo={r.sottotitolo}
          onSelect={() => vai(r.href)}
        />
      ))}
    </Command.Group>
  ));

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Cerca"
      shouldFilter={false}
      value={selezionata}
      onValueChange={setSelezionata}
      loop
      overlayClassName="fixed inset-0 z-40 bg-black/30"
      contentClassName="group/palette fixed top-[min(110px,10vh)] left-1/2 z-50 flex max-h-[min(560px,calc(100dvh-24px))] w-[min(600px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-line px-3.5">
        <Search aria-hidden className="size-4 flex-none text-fg-3" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Cerca clienti, preventivi, fatture… o cosa vuoi fare"
          className="h-12 min-w-0 flex-1 bg-transparent text-base outline-none! placeholder:text-fg-3 md:text-sm"
        />
        <kbd className="hidden flex-none rounded-sm border border-line bg-subtle px-1.5 py-0.5 font-sans text-xs text-fg-2 md:inline">
          esc
        </kbd>
      </div>
      <Command.List className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        <Command.Empty className="px-3 py-10 text-center text-sm text-fg-3">
          {cerco ? "Cerco…" : `Nessun risultato per «${query.trim()}»`}
        </Command.Empty>
        {funzioniPrima ? (
          <>
            {gruppiFunzioni}
            {gruppiContenuti}
          </>
        ) : (
          <>
            {gruppiContenuti}
            {gruppiFunzioni}
          </>
        )}
        {cerco && cercata && (contenuti.length > 0 || funzioni.length > 0) && (
          <p className={cn("px-3 py-2 text-xs text-fg-3")}>Cerco nei contenuti…</p>
        )}
      </Command.List>
      <div className="hidden shrink-0 items-center gap-4 border-t border-line bg-subtle px-3.5 py-2 text-xs text-fg-3 md:flex">
        <span>↑ ↓ per muoverti</span>
        <span>↵ per aprire</span>
        <span>esc per chiudere</span>
      </div>
    </Command.Dialog>
  );
}

"use client";

import { Command } from "cmdk";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { GRUPPI_NAV } from "@/lib/nav";

const EVENTO = "telaio:palette";
export const openPalette = () => window.dispatchEvent(new Event(EVENTO));

interface Risultato {
  tipo: "cliente" | "preventivo" | "fattura";
  titolo: string;
  sottotitolo?: string;
  href: string;
}

const AZIONI_RAPIDE = [
  { titolo: "Registra incasso", sub: "Bonifico, contante o carta", href: "/incassi", icona: "+" },
  {
    titolo: "Nuovo preventivo",
    sub: "Dal listino o dal configuratore",
    href: "/configuratore",
    icona: "+",
  },
  { titolo: "Nuova fattura", sub: "Libera, anche per privati", href: "/fatture/nuova", icona: "+" },
  { titolo: "Registra spesa", sub: "Prima nota", href: "/prima-nota", icona: "+" },
  { titolo: "Giroconto", sub: "Sposta soldi tra conti", href: "/prima-nota", icona: "⇄" },
  {
    titolo: "Azioni in attesa di conferma",
    sub: "Proposte da AI e API",
    href: "/azioni-in-attesa",
    icona: "!",
  },
];

const iniziali = (t: string) =>
  t
    .split(" ")
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [risultati, setRisultati] = useState<Risultato[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
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
    if (query.trim().length < 2) return setRisultati([]);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ricerca?q=${encodeURIComponent(query)}`, {
          signal: ctrl.signal,
        });
        if (res.ok) setRisultati(await res.json());
      } catch {}
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function vai(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const voce =
    "flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 data-[selected=true]:bg-hover";
  const gruppo =
    "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-fg-3";
  const icona = (t: string) => (
    <span
      aria-hidden
      className="grid size-6 flex-none place-items-center rounded-md border border-line bg-subtle text-xs font-medium text-fg-2"
    >
      {t}
    </span>
  );
  const testo = (titolo: string, sub?: string) => (
    <span className="flex min-w-0 flex-1 flex-col leading-tight">
      <span className="truncate text-sm text-fg">{titolo}</span>
      {sub && <span className="truncate text-xs text-fg-3">{sub}</span>}
    </span>
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Palette comandi"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-black/30"
      contentClassName="fixed top-[min(120px,12vh)] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-pop"
    >
      <div className="flex items-center gap-2.5 border-b border-line px-3">
        <Search aria-hidden className="size-4 text-fg-3" />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Cerca clienti, preventivi, fatture o scrivi un'azione…"
          className="h-11 w-full flex-1 bg-transparent text-sm outline-none placeholder:text-fg-3 focus-visible:outline-none"
        />
        <kbd className="rounded-sm border border-line bg-subtle px-1 font-sans text-xs text-fg-2">
          esc
        </kbd>
      </div>
      <Command.List className="max-h-[min(420px,55vh)] overflow-y-auto p-1.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-fg-3">
          Nessun risultato
        </Command.Empty>
        {risultati.length > 0 && (
          <Command.Group heading="Risultati" className={gruppo}>
            {risultati.map((r) => (
              <Command.Item
                key={r.href}
                value={`${r.tipo}-${r.href}`}
                onSelect={() => vai(r.href)}
                className={voce}
              >
                {icona(iniziali(r.titolo))}
                {testo(r.titolo, r.sottotitolo)}
                <span className="text-xs text-fg-3 capitalize">{r.tipo}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group heading="Azioni rapide" className={gruppo}>
          {AZIONI_RAPIDE.map((a) => (
            <Command.Item
              key={a.titolo}
              value={a.titolo}
              onSelect={() => vai(a.href)}
              className={voce}
            >
              {icona(a.icona)}
              {testo(a.titolo, a.sub)}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group heading="Pagine" className={gruppo}>
          {GRUPPI_NAV.flatMap((g) => g.voci).map((v) => (
            <Command.Item
              key={v.href}
              value={v.titolo}
              onSelect={() => vai(v.href)}
              className={voce}
            >
              {icona(v.titolo.slice(0, 1))}
              {testo(v.titolo)}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex items-center gap-4 border-t border-line bg-subtle px-3 py-1.5 text-xs text-fg-3">
        <span>↑ ↓ per muoverti</span>
        <span>↵ per aprire</span>
        <span>esc per chiudere</span>
      </div>
    </Command.Dialog>
  );
}

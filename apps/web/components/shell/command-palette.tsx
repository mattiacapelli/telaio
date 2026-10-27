"use client";

import { Command } from "cmdk";
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
    "flex min-h-[52px] cursor-pointer items-center gap-3.5 rounded-[14px] px-3.5 py-3 data-[selected=true]:bg-[#eceae5]";
  const gruppo =
    "[&_[cmdk-group-heading]]:px-3.5 [&_[cmdk-group-heading]]:pt-3.5 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-[0.14em] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-muted";
  const icona = (t: string) => (
    <span
      aria-hidden
      className="grid size-[34px] flex-none place-items-center rounded-[10px] bg-[#eceae5] text-xs font-semibold text-ink"
    >
      {t}
    </span>
  );
  const testo = (titolo: string, sub?: string) => (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="truncate text-[15px] font-semibold text-ink">{titolo}</span>
      {sub && <span className="truncate text-[13px] text-ink-2">{sub}</span>}
    </span>
  );

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Palette comandi"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-[rgba(23,21,15,.42)] backdrop-blur-[6px]"
      contentClassName="fixed top-[min(120px,12vh)] left-1/2 z-50 flex max-h-[min(666px,80vh)] w-[min(660px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-3xl bg-[#fbfaf8] shadow-[0_40px_90px_-30px_rgba(23,21,15,.6)]"
    >
      <div className="flex items-center gap-3.5 border-b border-ink/8 px-[22px]">
        <svg
          aria-hidden
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder="Cerca clienti, preventivi, fatture o scrivi un'azione…"
          className="min-h-[58px] w-full flex-1 bg-transparent text-[19px] outline-none focus-visible:outline-none placeholder:text-muted"
        />
        <kbd className="rounded-md border border-ink/16 bg-white px-1.5 py-1 font-sans text-[11px] font-medium text-ink-2">
          esc
        </kbd>
      </div>
      <Command.List className="max-h-[min(480px,55vh)] overflow-y-auto p-2.5">
        <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
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
                <span className="text-[13px] text-ink-2 capitalize">{r.tipo}</span>
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
              {icona(v.numero)}
              {testo(v.titolo)}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
      <div className="flex items-center gap-4 border-t border-ink/8 bg-paper px-5 py-2.5 text-[13px] text-ink-2">
        <span>↑ ↓ per muoverti</span>
        <span>↵ per aprire</span>
        <span>esc per chiudere</span>
      </div>
    </Command.Dialog>
  );
}

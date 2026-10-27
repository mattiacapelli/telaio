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
  { titolo: "Nuovo preventivo", href: "/configuratore" },
  { titolo: "Nuova fattura", href: "/fatture" },
  { titolo: "Azioni in attesa di conferma", href: "/azioni-in-attesa" },
];

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
    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-2xl px-3 text-sm data-[selected=true]:bg-ink data-[selected=true]:text-paper";

  return (
    <Command.Dialog
      open={open}
      onOpenChange={setOpen}
      label="Palette comandi"
      shouldFilter={false}
      overlayClassName="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm"
      contentClassName="fixed top-[15vh] left-1/2 z-50 w-[min(600px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[22px] border border-white/80 bg-paper shadow-2xl"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Cerca o digita un comando…"
        className="min-h-14 w-full border-b border-grey-2 bg-transparent px-5 text-base outline-none placeholder:text-muted"
      />
      <Command.List className="max-h-[50vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted">
          Nessun risultato
        </Command.Empty>
        {risultati.length > 0 && (
          <Command.Group
            heading="Risultati"
            className="mb-2 text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
          >
            {risultati.map((r) => (
              <Command.Item
                key={r.href}
                value={`${r.tipo}-${r.href}`}
                onSelect={() => vai(r.href)}
                className={voce}
              >
                <span>{r.titolo}</span>
                <span className="text-xs opacity-70">{r.sottotitolo ?? r.tipo}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}
        <Command.Group
          heading="Azioni rapide"
          className="mb-2 text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
        >
          {AZIONI_RAPIDE.map((a) => (
            <Command.Item
              key={a.href}
              value={a.titolo}
              onSelect={() => vai(a.href)}
              className={voce}
            >
              {a.titolo}
            </Command.Item>
          ))}
        </Command.Group>
        <Command.Group
          heading="Pagine"
          className="text-xs text-muted [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
        >
          {GRUPPI_NAV.flatMap((g) => g.voci).map((v) => (
            <Command.Item
              key={v.href}
              value={v.titolo}
              onSelect={() => vai(v.href)}
              className={voce}
            >
              <span>{v.titolo}</span>
              <span className="text-xs opacity-70">{v.numero}</span>
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

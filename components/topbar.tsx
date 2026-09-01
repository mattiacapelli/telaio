"use client";

import { usePathname, useRouter } from "next/navigation";
import { Moon, Sun, LogOut, Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavMobile } from "@/components/nav-mobile";

const TITOLI: Record<string, string> = {
  "/": "Dashboard",
  "/clienti": "Clienti",
  "/preventivi": "Preventivi",
  "/progetti": "Progetti",
  "/attivita": "Attività",
  "/ticket": "Ticket",
  "/ore": "Timesheet",
  "/contratti": "Contratti",
  "/fatture": "Fatture",
  "/incassi": "Incassi",
  "/workflow": "Workflow",
  "/impostazioni": "Impostazioni",
};

function titolo(pathname: string) {
  if (TITOLI[pathname]) return TITOLI[pathname];
  const base = "/" + (pathname.split("/")[1] ?? "");
  return TITOLI[base] ?? "Telaio";
}

export function Topbar({ utente }: { utente: string }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const { apri } = useNavMobile();

  useEffect(() => {
    const saved =
      (localStorage.getItem("telaio-theme") as "dark" | "light" | null) ?? null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("telaio-theme", theme);
    } catch {
      /* modalità privata: il tema resta valido per la sessione */
    }
  }, [theme]);

  return (
    <header className="sticky top-0 z-10 flex h-[48px] flex-none items-center gap-2 border-b border-border bg-bg px-3">
      <button
        onClick={apri}
        title="Apri il menu"
        className="grid h-[28px] w-[28px] flex-none place-items-center rounded-md text-muted transition-colors hover:bg-[var(--alpha-light)] hover:text-text md:hidden"
      >
        <Menu size={16} />
      </button>

      <h1 className="truncate text-md font-medium">{titolo(pathname)}</h1>

      <div className="flex-1" />

      <TimerPill />

      <button
        onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        title="Tema"
        className="grid h-[28px] w-[28px] place-items-center rounded-md text-muted transition-colors hover:bg-[var(--alpha-light)] hover:text-text"
      >
        {theme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
      </button>

      <MenuUtente nome={utente} />
    </header>
  );
}

/** Timer attivo, con stato condiviso lato server (Redis). */
function TimerPill() {
  const [secs, setSecs] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [etichetta, setEtichetta] = useState<string | null>(null);

  async function carica() {
    try {
      const r = await fetch("/api/timer", { cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      setSecs(d.secondi ?? 0);
      setRunning(Boolean(d.attivo));
      setEtichetta(d.etichetta ?? null);
    } catch {
      /* il timer è un extra: non deve rompere la topbar */
    }
  }

  useEffect(() => {
    carica();
    const poll = setInterval(carica, 15000);
    // Avviare/fermare il timer da un'altra pagina (es. un'attività) non
    // tocca questa topbar: senza l'evento, l'utente aspetterebbe fino a 15s
    // per vedere la pillola comparire o sparire.
    window.addEventListener("telaio:timer-cambiato", carica);
    return () => {
      clearInterval(poll);
      window.removeEventListener("telaio:timer-cambiato", carica);
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSecs((s) => (s === null ? s : s + 1)), 1000);
    return () => clearInterval(t);
  }, [running]);

  if (secs === null || !running) return null;

  const p = (n: number) => String(n).padStart(2, "0");
  const clock = `${p(Math.floor(secs / 3600))}:${p(
    Math.floor(secs / 60) % 60,
  )}:${p(secs % 60)}`;

  async function stop() {
    setRunning(false);
    await fetch("/api/timer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ azione: "stop" }),
    });
    window.dispatchEvent(new Event("telaio:timer-cambiato"));
    carica();
  }

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-accent-line bg-accent-soft px-3 py-1.5">
      <span className="tl-pulse h-1.5 w-1.5 rounded-full bg-accent" />
      <div className="text-md font-semibold tabular-nums">{clock}</div>
      {etichetta && (
        <span className="hidden max-w-[180px] truncate text-md text-muted sm:inline">
          {etichetta}
        </span>
      )}
      <button
        onClick={stop}
        className="rounded-md border border-border px-2 py-0.5 text-md text-muted transition-colors hover:border-border2 hover:text-text"
      >
        Stop
      </button>
    </div>
  );
}

/** Nome dell'utente connesso e uscita. */
function MenuUtente({ nome }: { nome: string }) {
  const router = useRouter();
  const [aperto, setAperto] = useState(false);
  const [inCorso, setInCorso] = useState(false);

  const iniziali = nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

  async function esci() {
    setInCorso(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setAperto((a) => !a)}
        title={nome}
        aria-haspopup="menu"
        aria-expanded={aperto}
        className="grid h-[28px] w-[28px] place-items-center rounded-md bg-accent-soft text-xs font-medium text-[var(--accent-text)] transition-colors hover:bg-accent-line"
      >
        {iniziali}
      </button>

      {aperto && (
        <>
          {/* Clic fuori dal menu per chiudere. */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setAperto(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow)]"
          >
            <div className="border-b border-border px-3 py-2">
              <div className="truncate text-md font-medium">{nome}</div>
              <div className="text-md text-faint">connesso</div>
            </div>
            <button
              onClick={esci}
              disabled={inCorso}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-md text-muted transition-colors hover:bg-surface2 hover:text-text disabled:opacity-50"
            >
              <LogOut size={14} />
              {inCorso ? "Esco…" : "Esci"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

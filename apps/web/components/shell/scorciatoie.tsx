"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";

/** «g» seguito da una lettera: come nei gestionali web (Gmail, Linear, GitHub). */
const VAI: { tasto: string; titolo: string; href: string }[] = [
  { tasto: "d", titolo: "Dashboard", href: "/" },
  { tasto: "c", titolo: "Clienti", href: "/clienti" },
  { tasto: "p", titolo: "Preventivi", href: "/preventivi" },
  { tasto: "j", titolo: "Progetti", href: "/progetti" },
  { tasto: "t", titolo: "Ticket", href: "/ticket" },
  { tasto: "l", titolo: "Listini", href: "/listini" },
  { tasto: "f", titolo: "Fatture", href: "/fatture" },
  { tasto: "i", titolo: "Incassi", href: "/incassi" },
  { tasto: "s", titolo: "Scadenzario", href: "/scadenzario" },
  { tasto: "b", titolo: "Abbonamenti", href: "/abbonamenti" },
  { tasto: "n", titolo: "Prima nota", href: "/prima-nota" },
  { tasto: "o", titolo: "Conti", href: "/conti" },
  { tasto: "w", titolo: "Cash flow", href: "/cash-flow" },
  { tasto: "r", titolo: "Report ed export", href: "/report" },
  { tasto: "a", titolo: "Azioni in attesa", href: "/azioni-in-attesa" },
  { tasto: "m", titolo: "Impostazioni", href: "/impostazioni/ragioni-sociali" },
];

function inCampoDiTesto(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

function Tasto({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-sm border border-line bg-subtle px-1.5 py-0.5 font-mono text-xs text-fg-2">
      {children}
    </kbd>
  );
}

/** Scorciatoie da tastiera per la navigazione; «?» mostra l'elenco. Non agiscono mai su dati. */
export function Scorciatoie() {
  const router = useRouter();
  const [aiuto, setAiuto] = useState(false);

  useEffect(() => {
    let inAttesaDi: ReturnType<typeof setTimeout> | undefined;
    let armato = false;
    const disarma = () => {
      armato = false;
      clearTimeout(inAttesaDi);
    };
    const alTasto = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || inCampoDiTesto(e.target)) return;
      // Con una finestra aperta (tranne questa) i tasti appartengono a lei.
      if (document.querySelector('[role="dialog"], [role="menu"]')) return;
      if (e.key === "?") {
        e.preventDefault();
        setAiuto(true);
        return disarma();
      }
      if (armato) {
        const voce = VAI.find((v) => v.tasto === e.key.toLowerCase());
        disarma();
        if (voce) {
          e.preventDefault();
          router.push(voce.href);
        }
        return;
      }
      if (e.key.toLowerCase() === "g") {
        armato = true;
        inAttesaDi = setTimeout(disarma, 1200);
      }
    };
    window.addEventListener("keydown", alTasto);
    return () => {
      disarma();
      window.removeEventListener("keydown", alTasto);
    };
  }, [router]);

  return (
    <Dialog open={aiuto} onOpenChange={setAiuto}>
      <DialogContent
        title="Scorciatoie da tastiera"
        description="Premi G e poi la lettera per andare a una sezione."
        footer={
          <DialogClose asChild>
            <Button variant="secondary">Chiudi</Button>
          </DialogClose>
        }
      >
        <ul className="grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          {VAI.map((v) => (
            <li key={v.tasto} className="flex items-center justify-between gap-3">
              <span>{v.titolo}</span>
              <span className="flex items-center gap-1">
                <Tasto>G</Tasto>
                <Tasto>{v.tasto.toUpperCase()}</Tasto>
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between gap-3">
            <span>Cerca ovunque</span>
            <Tasto>⌘ K</Tasto>
          </li>
          <li className="flex items-center justify-between gap-3">
            <span>Questo elenco</span>
            <Tasto>?</Tasto>
          </li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}

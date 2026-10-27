"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AZIONE_DEFAULT, AZIONI_PRINCIPALI } from "@/lib/nav";
import { openPalette } from "./command-palette";

export function Topbar() {
  const pathname = usePathname();
  const azione = AZIONI_PRINCIPALI[`/${pathname.split("/")[1] ?? ""}`] ?? AZIONE_DEFAULT;
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <button
        type="button"
        onClick={openPalette}
        className="glass-pill flex min-h-13 max-w-[440px] flex-[1_1_260px] items-center gap-3 px-[18px] text-left text-[15px] text-muted"
      >
        <Search className="size-[18px]" aria-hidden />
        <span className="flex-1">Cerca clienti, preventivi, fatture…</span>
        <kbd className="rounded-md border border-ink/16 px-1.5 py-0.5 font-sans text-xs">⌘K</kbd>
      </button>
      <div className="glass-pill flex min-h-13 items-center gap-3 pr-1.5 pl-[18px]">
        <Button asChild size="sm">
          <Link href={azione.href}>
            {azione.label}
            <span aria-hidden>+</span>
          </Link>
        </Button>
      </div>
    </header>
  );
}

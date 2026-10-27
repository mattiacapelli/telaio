"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AZIONE_DEFAULT, AZIONI_PRINCIPALI } from "@/lib/nav";
import { openPalette } from "./command-palette";

export function Topbar() {
  const pathname = usePathname();
  const azione = AZIONI_PRINCIPALI[`/${pathname.split("/")[1] ?? ""}`] ?? AZIONE_DEFAULT;
  return (
    <div className="mb-8 flex items-center gap-3">
      <button
        type="button"
        onClick={openPalette}
        className="glass-pill flex min-h-11 flex-1 items-center gap-3 px-4 text-left text-sm text-muted sm:max-w-md"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1">Cerca clienti, preventivi, fatture…</span>
        <kbd className="rounded-md border border-grey-2 px-1.5 py-0.5 text-xs">⌘K</kbd>
      </button>
      <div className="ml-auto">
        <Button asChild>
          <Link href={azione.href}>
            <Plus aria-hidden />
            {azione.label}
          </Link>
        </Button>
      </div>
    </div>
  );
}

"use client";

import { Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Dialog, DrawerContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { briciole } from "@/lib/nav";
import { EVENTO_MENU } from "./barra-inferiore";
import { openPalette } from "./command-palette";
import { MenuMobile } from "./menu-mobile";

const CREA = [
  { label: "Nuovo preventivo", href: "/preventivi/nuovo" },
  { label: "Nuovo progetto", href: "/progetti/nuovo" },
  { label: "Nuova fattura", href: "/fatture/nuova" },
  { label: "Registra incasso", href: "/incassi" },
  { label: "Nuovo abbonamento", href: "/abbonamenti" },
  { label: "Nuovo movimento", href: "/prima-nota" },
];

/** Intestazione: percorso a sinistra; a destra creazione rapida e ricerca globale. */
export function Header({
  utente,
  inAttesa,
}: {
  utente: { nome: string; email: string };
  inAttesa: number;
}) {
  const pathname = usePathname();
  const [menuAperto, setMenuAperto] = useState(false);
  useEffect(() => {
    const apri = () => setMenuAperto(true);
    window.addEventListener(EVENTO_MENU, apri);
    return () => window.removeEventListener(EVENTO_MENU, apri);
  }, []);
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 md:px-6">
      <Dialog open={menuAperto} onOpenChange={setMenuAperto}>
        <DrawerContent
          title="Menu"
          lato="sinistra"
          senzaIntestazione
          className="max-w-none bg-subtle"
        >
          <MenuMobile utente={utente} inAttesa={inAttesa} onChiudi={() => setMenuAperto(false)} />
        </DrawerContent>
      </Dialog>

      {/* Su telefono la navigazione sta nella barra in basso: qui resta solo la ricerca. */}
      <Breadcrumb voci={briciole(pathname)} className="hidden flex-1 md:block" />

      <button
        type="button"
        onClick={openPalette}
        className="flex h-8 flex-1 cursor-pointer items-center gap-2 rounded-md border border-line bg-surface px-2.5 text-sm text-fg-3 shadow-xs transition-colors duration-150 hover:border-line-strong md:w-64 md:flex-none"
      >
        <Search aria-hidden className="size-4" />
        <span className="flex-1 text-left">Cerca…</span>
        <kbd className="hidden rounded-sm border border-line bg-subtle px-1 font-sans text-xs text-fg-2 md:inline">
          ⌘K
        </kbd>
      </button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="hidden md:inline-flex">
            <Plus /> Nuovo
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {CREA.map((c) => (
            <DropdownMenuItem key={c.href + c.label} asChild>
              <Link href={c.href}>{c.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

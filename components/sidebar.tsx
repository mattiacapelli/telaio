"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Building2,
  FileText,
  FolderKanban,
  CircleCheck,
  LifeBuoy,
  Clock,
  Receipt,
  Wallet,
  FileSignature,
  Settings,
  Workflow,
  Bell,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { TileIcona, type Tinta } from "@/components/tile-icona";
import { useNavMobile } from "@/components/nav-mobile";

/**
 * Le voci di navigazione.
 *
 * Ogni voce ha un'icona dentro un riquadro tinto (TintedIconTile di Twenty):
 * il colore identifica la sezione e resta fisso, mentre è l'etichetta a
 * cambiare colore quando la voce è attiva.
 */
const OPERATIVO = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, tinta: "blue" },
  { href: "/clienti", label: "Clienti", icon: Building2, tinta: "sky" },
  { href: "/preventivi", label: "Preventivi", icon: FileText, tinta: "purple" },
  { href: "/progetti", label: "Progetti", icon: FolderKanban, tinta: "orange" },
  { href: "/attivita", label: "Attività", icon: CircleCheck, tinta: "green" },
  { href: "/ticket", label: "Ticket", icon: LifeBuoy, tinta: "red" },
  { href: "/ore", label: "Ore", icon: Clock, tinta: "turquoise" },
] as const;

const DENARO = [
  { href: "/contratti", label: "Contratti", icon: FileSignature, tinta: "purple" },
  { href: "/fatture", label: "Fatture", icon: Receipt, tinta: "pink" },
  { href: "/incassi", label: "Incassi", icon: Wallet, tinta: "yellow" },
] as const;

const AUTOMAZIONE = [
  { href: "/workflow", label: "Workflow", icon: Workflow, tinta: "purple" },
] as const;

const IMPOSTAZIONI = {
  href: "/impostazioni",
  label: "Impostazioni",
  icon: Settings,
  tinta: "gray",
} as const;

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { aperto, chiudi } = useNavMobile();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const Voce = ({
    href,
    label,
    icon: Icon,
    tinta,
  }: {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    tinta: Tinta;
  }) => {
    const attiva = isActive(href);
    return (
      <Link
        href={href}
        title={label}
        onClick={chiudi}
        className={cn(
          "flex h-[28px] items-center gap-[8px] rounded-md px-[4px] text-md transition-colors",
          attiva
            ? "bg-[var(--alpha-light)] text-text"
            : "text-muted hover:bg-[var(--alpha-light)] hover:text-text",
        )}
      >
        {/* TEXT.iconSizeMedium = 16, iconStrikeLight = 1.6 */}
        <TileIcona icona={Icon} tinta={tinta} />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const contenuto = (
    <>
      {/* Intestazione workspace, come la riga "Mattia Capelli" di Twenty. */}
      <div className="flex h-[48px] flex-none items-center gap-2 px-2">
        <div className="grid h-[24px] w-[24px] flex-none place-items-center rounded bg-accent text-xs font-semibold text-accent-fg">
          T
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1">
            <div className="truncate text-md font-medium">Studio Ferrero</div>
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          title={collapsed ? "Espandi" : "Comprimi"}
          className="hidden h-6 w-6 flex-none place-items-center rounded text-faint transition-colors hover:bg-surface2 hover:text-text md:grid"
        >
          {collapsed ? <PanelLeft size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {!collapsed && (
          <div className="px-1 pb-1 pt-3 text-md font-medium text-faint">
            Operativo
          </div>
        )}
        {OPERATIVO.map((v) => (
          <Voce key={v.href} {...v} />
        ))}

        {!collapsed && (
          <div className="px-1 pb-1 pt-3 text-md font-medium text-faint">
            Denaro
          </div>
        )}
        {DENARO.map((v) => (
          <Voce key={v.href} {...v} />
        ))}

        {!collapsed && (
          <div className="px-1 pb-1 pt-3 text-md font-medium text-faint">
            Automazione
          </div>
        )}
        {AUTOMAZIONE.map((v) => (
          <Voce key={v.href} {...v} />
        ))}

      </nav>

      {/* Fuori dal nav scrollabile: resta ancorata, con margine per il badge dev. */}
      <div className="flex-none border-t border-border px-2 pb-[64px] pt-2 md:pb-2">
        <Voce {...IMPOSTAZIONI} />
      </div>
    </>
  );

  return (
    <>
      {/* Desktop: colonna fissa sempre visibile. */}
      <aside
        className="sticky top-0 hidden h-screen flex-none flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200 md:flex"
        style={{ width: collapsed ? 56 : 220 }}
      >
        {contenuto}
      </aside>

      {/* Mobile: drawer sopra il contenuto, chiuso di default. */}
      {aperto && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={chiudi} />
          <aside className="absolute left-0 top-0 flex h-full w-[260px] max-w-[80vw] flex-col overflow-hidden border-r border-border bg-surface shadow-[var(--shadow)]">
            {contenuto}
          </aside>
        </div>
      )}
    </>
  );
}

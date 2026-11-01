"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { GRUPPI_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ICONE_NAV } from "./nav-icone";
import { UserMenu } from "./user-menu";

/** Voci mostrate in fondo al menu, sopra il profilo. */
const VOCI_IN_FONDO = ["/impostazioni/ragioni-sociali", "/azioni-in-attesa"];

export function voceAttiva(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (href.startsWith("/impostazioni")) return pathname.startsWith("/impostazioni");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Logo({ compatto = false }: { compatto?: boolean }) {
  return (
    <Link href="/" aria-label="Telaio" className="flex items-center gap-2 rounded-md px-1 py-1">
      <span className="grid size-6 shrink-0 place-items-center rounded-md bg-fg text-xs font-semibold text-white">
        T
      </span>
      {!compatto && <span className="text-base font-semibold tracking-tight text-fg">Telaio</span>}
    </Link>
  );
}

function VoceMenu({
  href,
  titolo,
  compatto,
  attiva,
  conteggio,
  onNavigate,
}: {
  href: string;
  titolo: string;
  compatto: boolean;
  attiva: boolean;
  conteggio?: number;
  onNavigate?: () => void;
}) {
  const Icona = ICONE_NAV[href];
  const link = (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={attiva ? "page" : undefined}
      aria-label={compatto ? titolo : undefined}
      className={cn(
        "flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors duration-150",
        compatto && "justify-center px-0",
        attiva ? "bg-hover font-medium text-fg" : "text-fg-2 hover:bg-hover hover:text-fg",
      )}
    >
      {Icona && (
        <Icona aria-hidden className={cn("size-4 shrink-0", attiva ? "text-fg" : "text-fg-3")} />
      )}
      {!compatto && <span className="flex-1 truncate">{titolo}</span>}
      {!compatto && !!conteggio && <Badge variant="brand">{conteggio}</Badge>}
    </Link>
  );
  return compatto ? (
    <Tooltip content={titolo} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

/** Contenuto del menu: lo usano la barra laterale e il pannello mobile. */
export function NavContenuto({
  compatto = false,
  utente,
  inAttesa,
  onNavigate,
}: {
  compatto?: boolean;
  utente: { nome: string; email: string };
  inAttesa: number;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <>
      <nav
        aria-label="Navigazione principale"
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-2 py-2"
      >
        {GRUPPI_NAV.filter((g) => g.voci.some((v) => !VOCI_IN_FONDO.includes(v.href))).map(
          (gruppo) => (
            <div key={gruppo.titolo} className="flex flex-col gap-0.5">
              {compatto ? (
                <div className="mx-2 mb-1 h-px bg-line" />
              ) : (
                <p className="px-2 pb-1 text-xs font-medium text-fg-3">{gruppo.titolo}</p>
              )}
              {gruppo.voci
                .filter(
                  (v) =>
                    v.href !== "/impostazioni/ragioni-sociali" && v.href !== "/azioni-in-attesa",
                )
                .map((v) => (
                  <VoceMenu
                    key={v.href}
                    href={v.href}
                    titolo={v.titolo}
                    compatto={compatto}
                    attiva={voceAttiva(pathname, v.href)}
                    onNavigate={onNavigate}
                  />
                ))}
            </div>
          ),
        )}
      </nav>
      <div className="flex flex-col gap-0.5 border-t border-line px-2 py-2">
        <VoceMenu
          href="/azioni-in-attesa"
          titolo="Azioni in attesa"
          compatto={compatto}
          attiva={voceAttiva(pathname, "/azioni-in-attesa")}
          conteggio={inAttesa}
          onNavigate={onNavigate}
        />
        <VoceMenu
          href="/impostazioni/ragioni-sociali"
          titolo="Impostazioni"
          compatto={compatto}
          attiva={voceAttiva(pathname, "/impostazioni")}
          onNavigate={onNavigate}
        />
        <UserMenu nome={utente.nome} email={utente.email} compatto={compatto} />
      </div>
    </>
  );
}

/** Barra laterale compatta e comprimibile; lo stato si ricorda in un cookie. */
export function Sidebar({
  utente,
  inAttesa,
  iniziaCompatta,
}: {
  utente: { nome: string; email: string };
  inAttesa: number;
  iniziaCompatta: boolean;
}) {
  const [compatta, setCompatta] = useState(iniziaCompatta);
  const alterna = () => {
    const nuovo = !compatta;
    setCompatta(nuovo);
    document.cookie = `sidebar=${nuovo ? "compatta" : "estesa"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-line bg-subtle transition-[width] duration-150 md:flex",
        compatta ? "w-[var(--sidebar-w-collapsed)]" : "w-[var(--sidebar-w)]",
      )}
    >
      <div
        className={cn(
          "flex h-12 shrink-0 items-center px-2",
          compatta ? "justify-center" : "justify-between",
        )}
      >
        {compatta ? (
          <IconButton label="Espandi il menu" onClick={alterna}>
            <PanelLeftOpen />
          </IconButton>
        ) : (
          <>
            <Logo />
            <IconButton label="Comprimi il menu" onClick={alterna}>
              <PanelLeftClose />
            </IconButton>
          </>
        )}
      </div>
      <NavContenuto compatto={compatta} utente={utente} inAttesa={inAttesa} />
    </aside>
  );
}

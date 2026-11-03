"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";
import { GRUPPI_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { ICONE_NAV } from "./nav-icone";
import { Logo, voceAttiva } from "./sidebar";
import { UserMenu } from "./user-menu";

/** Le voci di sistema hanno un posto loro, in fondo. */
const VOCI_SISTEMA = ["/impostazioni/ragioni-sociali", "/azioni-in-attesa"];

/**
 * Menu completo per telefono: riquadri grandi da toccare con il pollice, raggruppati per area.
 * Non riusa la barra laterale del desktop, pensata per il mouse.
 */
export function MenuMobile({
  utente,
  inAttesa,
  onChiudi,
}: {
  utente: { nome: string; email: string };
  inAttesa: number;
  onChiudi: () => void;
}) {
  const pathname = usePathname();
  return (
    <div className="-mx-5 -my-4 flex h-full flex-col">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Logo />
        <IconButton label="Chiudi il menu" onClick={onChiudi}>
          <X />
        </IconButton>
      </div>

      <nav
        aria-label="Tutte le sezioni"
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-4 pt-1 pb-4"
      >
        {inAttesa > 0 && (
          <Link
            href="/azioni-in-attesa"
            onClick={onChiudi}
            className="flex min-h-12 items-center justify-between gap-3 rounded-lg border border-brand/25 bg-brand/10 px-4 text-sm font-medium text-fg active:bg-brand/15"
          >
            Azioni in attesa di conferma
            <Badge variant="brand">{inAttesa}</Badge>
          </Link>
        )}

        {GRUPPI_NAV.map((gruppo) => {
          const voci = gruppo.voci.filter((v) => !VOCI_SISTEMA.includes(v.href));
          if (voci.length === 0) return null;
          return (
            <section key={gruppo.titolo} className="flex flex-col gap-2">
              <h2 className="px-1 text-xs font-medium text-fg-3">{gruppo.titolo}</h2>
              <div className="grid grid-cols-2 gap-2">
                {voci.map((v) => {
                  const Icona = ICONE_NAV[v.href];
                  const attiva = voceAttiva(pathname, v.href);
                  return (
                    <Link
                      key={v.href}
                      href={v.href}
                      onClick={onChiudi}
                      aria-current={attiva ? "page" : undefined}
                      className={cn(
                        "flex min-h-14 items-center gap-2.5 rounded-lg border px-3 text-sm transition-colors duration-150",
                        attiva
                          ? "border-brand/30 bg-brand/10 font-medium text-fg"
                          : "border-line bg-surface text-fg-2 active:bg-hover",
                      )}
                    >
                      {Icona && (
                        <Icona
                          aria-hidden
                          className={cn("size-5 shrink-0", attiva ? "text-brand" : "text-fg-3")}
                        />
                      )}
                      <span className="min-w-0 leading-tight">{v.titolo}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}

        <Link
          href="/impostazioni/ragioni-sociali"
          onClick={onChiudi}
          aria-current={voceAttiva(pathname, "/impostazioni") ? "page" : undefined}
          className="flex min-h-12 items-center gap-2.5 rounded-lg border border-line bg-surface px-3 text-sm text-fg-2 active:bg-hover"
        >
          {(() => {
            const Icona = ICONE_NAV["/impostazioni/ragioni-sociali"];
            return Icona ? <Icona aria-hidden className="size-5 shrink-0 text-fg-3" /> : null;
          })()}
          Impostazioni
        </Link>
      </nav>

      <div className="flex shrink-0 flex-col border-t border-line bg-subtle px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <UserMenu nome={utente.nome} email={utente.email} lato="top" />
      </div>
    </div>
  );
}

"use client";

import { FileText, LayoutDashboard, Menu, Receipt, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Evento con cui la barra chiede all'intestazione di aprire il menu completo. */
export const EVENTO_MENU = "telaio:apri-menu";

const VOCI = [
  { href: "/", etichetta: "Home", icona: LayoutDashboard, esatto: true },
  { href: "/clienti", etichetta: "Clienti", icona: Users },
  { href: "/preventivi", etichetta: "Preventivi", icona: FileText },
  { href: "/fatture", etichetta: "Fatture", icona: Receipt },
] as const;

/** Navigazione principale a una mano, solo su telefono: le sezioni più usate e il menu completo. */
export function BarraInferiore({ inAttesa }: { inAttesa: number }) {
  const pathname = usePathname();
  const attiva = (href: string, esatto?: boolean) =>
    esatto ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
  const voce =
    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150 [&_svg]:size-5";
  return (
    <nav
      aria-label="Sezioni principali"
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      {VOCI.map(({ href, etichetta, icona: Icona, ...resto }) => {
        const on = attiva(href, "esatto" in resto ? resto.esatto : false);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(voce, on ? "text-brand" : "text-fg-2 active:bg-hover")}
          >
            <Icona aria-hidden />
            {etichetta}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(EVENTO_MENU))}
        className={cn(voce, "cursor-pointer text-fg-2 active:bg-hover")}
      >
        <Menu aria-hidden />
        Menu
        {inAttesa > 0 && (
          <span
            role="status"
            aria-label={`${inAttesa} azioni in attesa`}
            className="absolute top-1.5 left-1/2 ml-1.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-brand-fg"
          >
            {inAttesa}
          </span>
        )}
      </button>
    </nav>
  );
}

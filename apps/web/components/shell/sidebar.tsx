"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPPI_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigazione principale" className="mt-6 flex flex-col gap-6">
      {GRUPPI_NAV.map((gruppo) => (
        <div key={gruppo.titolo}>
          <p className="eyebrow mb-2 px-3">{gruppo.titolo}</p>
          <ul className="flex flex-col gap-0.5">
            {gruppo.voci.map((voce) => {
              const attiva =
                pathname === voce.href ||
                pathname.startsWith(`${voce.href}/`) ||
                (voce.href.startsWith("/impostazioni") && pathname.startsWith("/impostazioni"));
              return (
                <li key={voce.href}>
                  <Link
                    href={voce.href}
                    aria-current={attiva ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-full px-3 text-sm transition-colors",
                      attiva ? "glass-pill font-semibold text-ink" : "text-ink-2 hover:bg-white/50",
                    )}
                  >
                    <span className="w-6 text-xs tabular-nums text-muted">{voce.numero}</span>
                    {voce.titolo}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

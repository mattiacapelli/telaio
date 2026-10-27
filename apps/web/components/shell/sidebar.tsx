"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPPI_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigazione principale" className="flex flex-col">
      {GRUPPI_NAV.map((gruppo, i) => (
        <div key={gruppo.titolo}>
          <p
            className={cn(
              "border-b border-ink/14 pr-1 pb-2.5 pl-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted",
              i === 0 ? "pt-0" : "pt-5.5",
            )}
          >
            {gruppo.titolo}
          </p>
          <ul>
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
                      "flex items-baseline gap-3.5 border-b border-ink/8 px-1 py-[11px] text-[15px] leading-tight transition-colors",
                      attiva ? "font-semibold text-ink" : "font-medium text-ink-2 hover:text-ink",
                    )}
                  >
                    <span className="w-5 text-xs font-medium text-muted">{voce.numero}</span>
                    {voce.titolo}
                    {attiva && (
                      <span
                        aria-hidden
                        className="ml-auto size-[7px] self-center rounded-full bg-ink"
                      />
                    )}
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

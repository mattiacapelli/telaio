"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GRUPPI_NAV } from "@/lib/nav";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigazione principale" style={{ display: "flex", flexDirection: "column" }}>
      {GRUPPI_NAV.map((gruppo, i) => (
        <div key={gruppo.titolo} style={{ display: "flex", flexDirection: "column" }}>
          <span className="ng" style={i === 0 ? { paddingTop: 0 } : undefined}>
            {gruppo.titolo}
          </span>
          {gruppo.voci.map((voce) => {
            const attiva =
              voce.href === "/"
                ? pathname === "/"
                : pathname === voce.href ||
                  pathname.startsWith(`${voce.href}/`) ||
                  (voce.href.startsWith("/impostazioni") && pathname.startsWith("/impostazioni"));
            return (
              <Link
                key={voce.href}
                href={voce.href}
                aria-current={attiva ? "page" : undefined}
                className={cn("ni", attiva && "on")}
              >
                <span>{voce.numero}</span>
                {voce.titolo}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

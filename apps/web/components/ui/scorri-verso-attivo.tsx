"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Riga orizzontale scorrevole che all'apertura si porta sulla voce attiva (`aria-current`),
 * così su telefono non resta nascosta fuori dallo schermo.
 */
export function ScorriVersoAttivo({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const contenitore = ref.current;
    const attiva = contenitore?.querySelector<HTMLElement>("[aria-current]");
    if (!contenitore || !attiva) return;
    contenitore.scrollLeft = Math.max(
      0,
      attiva.offsetLeft - (contenitore.clientWidth - attiva.offsetWidth) / 2,
    );
  }, []);
  return (
    <div ref={ref} className={cn("no-scrollbar", className)} {...props}>
      {children}
    </div>
  );
}

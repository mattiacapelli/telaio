"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Stato aperto/chiuso del drawer di navigazione su mobile.
 *
 * Topbar (bottone hamburger) e Sidebar (drawer) sono fratelli nel layout:
 * un context evita di far attraversare lo stato al layout server component
 * che li monta entrambi.
 */
const NavMobileContext = createContext<{
  aperto: boolean;
  apri: () => void;
  chiudi: () => void;
} | null>(null);

export function NavMobileProvider({ children }: { children: ReactNode }) {
  const [aperto, setAperto] = useState(false);
  return (
    <NavMobileContext.Provider
      value={{ aperto, apri: () => setAperto(true), chiudi: () => setAperto(false) }}
    >
      {children}
    </NavMobileContext.Provider>
  );
}

export function useNavMobile() {
  const ctx = useContext(NavMobileContext);
  if (!ctx) throw new Error("useNavMobile va usato dentro NavMobileProvider");
  return ctx;
}

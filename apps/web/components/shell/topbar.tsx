import Link from "next/link";
import { SearchPill } from "./search-pill";

/**
 * Barra superiore delle liste: ricerca a sinistra, a destra un link secondario
 * e l'azione principale (un `.bp.sm`, oppure una modale passata come children).
 */
export function TopBar({
  placeholder = "Cerca clienti, preventivi, incassi…",
  links = [],
  children,
}: {
  placeholder?: string;
  links?: { label: string; href: string }[];
  children?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <SearchPill placeholder={placeholder} />
      {(links.length > 0 || children) && (
        <div className="glass pill" style={{ paddingRight: children ? 6 : 18 }}>
          {links.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 14, fontWeight: 500 }}>
              {l.label}
            </Link>
          ))}
          {children}
        </div>
      )}
    </header>
  );
}

/** Barra delle pagine di dettaglio: «← indietro», stato e azioni. */
export function DetailBar({
  indietro,
  stato,
  children,
}: {
  indietro: { label: string; href: string };
  stato?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <Link href={indietro.href} className="glass pill" style={{ fontWeight: 500, fontSize: 15 }}>
        <span aria-hidden="true">←</span> {indietro.label}
      </Link>
      {stato && (
        <div className="glass pill" style={{ fontSize: 14, color: "#3a372f" }}>
          {stato}
        </div>
      )}
      {children && (
        <div className="glass pill" style={{ paddingRight: 6, gap: 6 }}>
          {children}
        </div>
      )}
    </header>
  );
}

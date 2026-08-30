import type { LucideIcon } from "lucide-react";

/**
 * Icona dentro un riquadro tinto, come il `TintedIconTile` di Twenty.
 *
 * La ricetta è la loro (TINTED_ICON_TILE_COLOR_SHADES): per ogni famiglia di
 * colore lo sfondo usa la tinta 5, il bordo la 6 e l'icona la 11. I valori
 * vengono dalle scale Radix in display-p3 usate da SecondaryColors*.
 *
 * Le tinte cambiano con il tema, quindi sono esposte come variabili CSS in
 * globals.css e qui si referenziano soltanto.
 */
export type Tinta =
  | "blue"
  | "purple"
  | "orange"
  | "green"
  | "pink"
  | "turquoise"
  | "red"
  | "yellow"
  | "sky"
  | "gray";

export function TileIcona({
  icona: Icona,
  tinta,
  dimensione = 20,
}: {
  icona: LucideIcon;
  tinta: Tinta;
  dimensione?: number;
}) {
  return (
    <span
      className="flex flex-none items-center justify-center rounded-sm border"
      style={{
        width: dimensione,
        height: dimensione,
        // StyledTintedIconTileContainer: raggio sm, bordo 1px, sfondo tinto.
        background: `var(--tile-${tinta}-bg)`,
        borderColor: `var(--tile-${tinta}-bd)`,
      }}
    >
      {/*
        Il tile è 20px con l'icona a 14px (ICON.size.sm): l'icona riempie il
        riquadro lasciando il bordo visibile, come nella sidebar di Twenty.
      */}
      <Icona
        size={Math.round(dimensione * 0.7)}
        strokeWidth={2}
        style={{ color: `var(--tile-${tinta}-ic)` }}
      />
    </span>
  );
}

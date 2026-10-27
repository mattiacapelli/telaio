/** Divisione intera arrotondata al più vicino, metà lontano da zero. */
export function roundDiv(numerator: number, denominator: number): number {
  if (denominator === 0) throw new Error("Divisione per zero");
  const sign = numerator < 0 !== denominator < 0 ? -1 : 1;
  const n = Math.abs(numerator);
  const d = Math.abs(denominator);
  return sign * Math.floor((2 * n + d) / (2 * d));
}

/** Percentuale in punti base applicata a un importo in centesimi. */
export function percentuale(importoCent: number, bp: number): number {
  return roundDiv(importoCent * bp, 10000);
}

const numero = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

/** "€ 1.275,00": il simbolo davanti, come nei mockup; i negativi come "− € 200,00". */
export function formatEuro(cent: number): string {
  const testo = `€ ${numero.format(Math.abs(cent) / 100)}`;
  return cent < 0 ? `− ${testo}` : testo;
}

/** Come formatEuro ma senza decimali se l'importo è tondo ("€ 7.225"). */
export function formatEuroCompatto(cent: number): string {
  return cent % 100 === 0 ? formatEuro(cent).replace(/,00$/, "") : formatEuro(cent);
}

/** "12,50" | "12.50" | "1.234,5" → 1250 | 1250 | 123450. Null se non valido. */
export function parseEuro(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

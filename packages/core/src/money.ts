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

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
  useGrouping: "always",
});

export function formatEuro(cent: number): string {
  return eur.format(cent / 100);
}

/** "12,50" | "12.50" | "1.234,5" → 1250 | 1250 | 123450. Null se non valido. */
export function parseEuro(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/€/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  return Math.round(Number(normalized) * 100);
}

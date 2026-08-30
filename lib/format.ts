/*
 * Il design mostra gli importi come "€ 1.234", con il simbolo davanti.
 * `it-IT` con style:"currency" lo mette invece in coda ("1.234 €"), quindi
 * formattiamo il solo numero e anteponiamo noi il simbolo.
 */
const NUM = new Intl.NumberFormat("it-IT", {
  maximumFractionDigits: 0,
  useGrouping: "always",
});
const NUM_CENT = new Intl.NumberFormat("it-IT", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: "always",
});

/** Prisma restituisce Decimal: accettiamo qualunque forma numerica. */
type Num = number | string | { toString(): string } | null | undefined;

export function n(v: Num): number {
  if (v === null || v === undefined) return 0;
  return typeof v === "number" ? v : Number(v.toString());
}

export const eur = (v: Num) => `€ ${NUM.format(n(v))}`;
export const eurCent = (v: Num) => `€ ${NUM_CENT.format(n(v))}`;

export function ore(v: Num) {
  const x = n(v);
  return `${x.toLocaleString("it-IT", { maximumFractionDigits: 2 })} h`;
}

/**
 * Le date di dominio sono `@db.Date` (mezzanotte UTC): vanno formattate in UTC,
 * altrimenti a ovest di Greenwich mostrerebbero il giorno precedente.
 */
export function data(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  });
}

export function dataEstesa(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function daGiorni(d: Date | string | null | undefined) {
  if (!d) return null;
  const ms = Date.now() - new Date(d).getTime();
  return Math.floor(ms / 86400000);
}

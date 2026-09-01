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
 * "2:30:00", "2:30" o "2" (ore, minuti, secondi) → ore decimali. Accetta
 * anche solo ore o ore:minuti, per non forzare a digitare ":00" ogni volta.
 * Ritorna null se il formato non è riconoscibile, mai NaN silenzioso.
 */
export function parseTempo(v: string): number | null {
  const pulito = v.trim();
  if (!pulito) return null;
  const parti = pulito.split(":").map((p) => p.trim());
  if (parti.length > 3 || parti.some((p) => p === "" || !/^\d+$/.test(p))) return null;

  const [h, m = "0", s = "0"] = parti;
  const ore = Number(h);
  const minuti = Number(m);
  const secondi = Number(s);
  if (minuti >= 60 || secondi >= 60) return null;

  return ore + minuti / 60 + secondi / 3600;
}

/** Ore decimali → "H:MM:SS", per pre-compilare il campo tempo in modifica. */
export function formatTempo(v: Num): string {
  const totaleSecondi = Math.round(n(v) * 3600);
  const h = Math.floor(totaleSecondi / 3600);
  const m = Math.floor((totaleSecondi % 3600) / 60);
  const s = totaleSecondi % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

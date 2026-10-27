/** Data di oggi (YYYY-MM-DD) nel fuso di Roma. */
export function oggi(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

export function formatData(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const reData = /^\d{4}-\d{2}-\d{2}$/;

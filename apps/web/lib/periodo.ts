import { aggiungiMesi } from "@telaio/core";

export type Periodo = "mese" | "trimestre" | "anno";

const ROMANI = ["I", "II", "III", "IV"];

/** Intervallo [da, a) del periodo che contiene `oggi`, più l'etichetta da mostrare. */
export function intervallo(periodo: Periodo, oggi: string) {
  const anno = Number(oggi.slice(0, 4));
  const mese = Number(oggi.slice(5, 7));
  if (periodo === "anno")
    return { da: `${anno}-01-01`, a: `${anno + 1}-01-01`, etichetta: `Anno ${anno}` };
  if (periodo === "trimestre") {
    const q = Math.floor((mese - 1) / 3);
    const da = `${anno}-${String(q * 3 + 1).padStart(2, "0")}-01`;
    return { da, a: aggiungiMesi(da, 3), etichetta: `${ROMANI[q]} trimestre ${anno}` };
  }
  const da = `${oggi.slice(0, 7)}-01`;
  return {
    da,
    a: aggiungiMesi(da, 1),
    etichetta: new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${da}T00:00:00Z`)),
  };
}

export const valorePeriodo = (v: string | undefined): Periodo =>
  v === "mese" || v === "trimestre" ? v : "anno";

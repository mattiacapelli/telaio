/**
 * Calcolo del totale di un preventivo.
 *
 * Vive qui perché serve identico in tre punti: anteprima nel form, salvataggio
 * lato server e rendering del documento. Duplicarlo significherebbe vedere un
 * totale nel form e salvarne un altro.
 *
 * L'ordine conta: sconto di riga → sconto sul totale → IVA.
 */

export type VoceCalcolo = {
  quantita: number;
  prezzo: number;
  /** Sconto percentuale sulla riga (0–100). */
  sconto?: number;
};

/** Imponibile di una singola riga, al netto del suo sconto. */
export function totaleRiga(v: VoceCalcolo) {
  const lordo = (Number(v.quantita) || 0) * (Number(v.prezzo) || 0);
  const sconto = Math.min(Math.max(Number(v.sconto) || 0, 0), 100);
  return lordo * (1 - sconto / 100);
}

export type Riepilogo = {
  /** Somma delle righe prima di qualsiasi sconto. */
  lordo: number;
  /** Totale degli sconti di riga. */
  scontiRiga: number;
  /** Somma delle righe scontate. */
  imponibileLordo: number;
  /** Sconto applicato sul totale. */
  scontoTotale: number;
  /** Base imponibile finale. */
  imponibile: number;
  iva: number;
  totale: number;
};

export function calcolaPreventivo(
  voci: VoceCalcolo[],
  scontoPercento = 0,
  aliquotaIva = 22,
): Riepilogo {
  const lordo = voci.reduce(
    (s, v) => s + (Number(v.quantita) || 0) * (Number(v.prezzo) || 0),
    0,
  );
  const imponibileLordo = voci.reduce((s, v) => s + totaleRiga(v), 0);
  const scontiRiga = lordo - imponibileLordo;

  const pctTotale = Math.min(Math.max(Number(scontoPercento) || 0, 0), 100);
  const scontoTotale = imponibileLordo * (pctTotale / 100);
  const imponibile = imponibileLordo - scontoTotale;

  const iva = imponibile * ((Number(aliquotaIva) || 0) / 100);

  // Arrotondiamo solo in uscita: arrotondare a ogni passaggio farebbe
  // divergere il totale dalla somma delle righe.
  const r2 = (x: number) => Math.round(x * 100) / 100;

  return {
    lordo: r2(lordo),
    scontiRiga: r2(scontiRiga),
    imponibileLordo: r2(imponibileLordo),
    scontoTotale: r2(scontoTotale),
    imponibile: r2(imponibile),
    iva: r2(iva),
    totale: r2(imponibile + iva),
  };
}

export const UNITA: Record<string, string> = {
  ORE: "ore",
  GIORNI: "giorni",
  CORPO: "a corpo",
  PEZZI: "pezzi",
};

/** Abbreviazione per le tabelle strette. */
export const UNITA_BREVE: Record<string, string> = {
  ORE: "h",
  GIORNI: "gg",
  CORPO: "corpo",
  PEZZI: "pz",
};

import { percentuale } from "./money";

export const SOGLIA_BOLLO_CENT = 7747;
export const IMPORTO_BOLLO_CENT = 200;

export interface RegoleFiscali {
  ivaAttiva: boolean;
  /** punti base: 2200 = 22% */
  aliquotaIvaBp: number;
  naturaSenzaIva?: string | null;
  diciturSenzaIva?: string | null;
  bolloAutomatico: boolean;
  /** punti base sull'imponibile; 0/null = nessuna ritenuta */
  ritenutaBp?: number | null;
  splitPayment: boolean;
}

export interface RigaCalcolo {
  /** quantità intera */
  quantita: number;
  prezzoUnitarioCent: number;
  /** sconto in punti base */
  scontoBp?: number;
}

export interface Totali {
  imponibileCent: number;
  ivaCent: number;
  bolloCent: number;
  totaleCent: number;
  ritenutaCent: number;
  /** IVA che il cliente PA versa all'erario invece che al fornitore */
  ivaSplitCent: number;
  nettoDaPagareCent: number;
}

export function importoRiga(riga: RigaCalcolo): number {
  const lordo = riga.quantita * riga.prezzoUnitarioCent;
  return lordo - percentuale(lordo, riga.scontoBp ?? 0);
}

export function calcolaTotali(righe: RigaCalcolo[], regole: RegoleFiscali): Totali {
  const imponibileCent = righe.reduce((s, r) => s + importoRiga(r), 0);
  const ivaCent = regole.ivaAttiva ? percentuale(imponibileCent, regole.aliquotaIvaBp) : 0;
  const bolloCent =
    !regole.ivaAttiva && regole.bolloAutomatico && imponibileCent > SOGLIA_BOLLO_CENT
      ? IMPORTO_BOLLO_CENT
      : 0;
  const totaleCent = imponibileCent + ivaCent + bolloCent;
  const ritenutaCent = regole.ritenutaBp ? percentuale(imponibileCent, regole.ritenutaBp) : 0;
  const ivaSplitCent = regole.splitPayment ? ivaCent : 0;
  return {
    imponibileCent,
    ivaCent,
    bolloCent,
    totaleCent,
    ritenutaCent,
    ivaSplitCent,
    nettoDaPagareCent: totaleCent - ritenutaCent - ivaSplitCent,
  };
}

export interface PrezzoVisualizzato {
  nettoCent: number;
  /** presente solo se la ragione sociale applica l'IVA */
  lordoCent: number | null;
  ivaCent: number | null;
  dicitura: string | null;
}

/** Un prezzo si mostra netto e lordo se c'è IVA, altrimenti uno solo con la dicitura. */
export function prezzoVisualizzato(nettoCent: number, regole: RegoleFiscali): PrezzoVisualizzato {
  if (!regole.ivaAttiva) {
    return { nettoCent, lordoCent: null, ivaCent: null, dicitura: regole.diciturSenzaIva ?? null };
  }
  const ivaCent = percentuale(nettoCent, regole.aliquotaIvaBp);
  return { nettoCent, lordoCent: nettoCent + ivaCent, ivaCent, dicitura: null };
}

export function formatAliquota(bp: number): string {
  const v = bp / 100;
  return `${Number.isInteger(v) ? v : v.toFixed(2).replace(".", ",")}%`;
}

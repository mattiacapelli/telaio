export type Periodicita = "mensile" | "trimestrale" | "semestrale" | "annuale";

export const MESI_PER_PERIODICITA: Record<Periodicita, number> = {
  mensile: 1,
  trimestrale: 3,
  semestrale: 6,
  annuale: 12,
};

export interface RataGenerata {
  /** YYYY-MM-DD */
  scadenza: string;
  importoCent: number;
  numero: number;
}

function parse(data: string): { y: number; m: number; d: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!match) throw new Error(`Data non valida: ${data}`);
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Aggiunge mesi mantenendo il giorno di partenza; se non esiste, ultimo giorno del mese. */
export function aggiungiMesi(data: string, mesi: number): string {
  const { y, m, d } = parse(data);
  const indice = y * 12 + (m - 1) + mesi;
  const anno = Math.floor(indice / 12);
  const mese = (indice % 12) + 1;
  const ultimoGiorno = new Date(Date.UTC(anno, mese, 0)).getUTCDate();
  return `${anno}-${pad(mese)}-${pad(Math.min(d, ultimoGiorno))}`;
}

export interface OpzioniRate {
  /** prima scadenza, YYYY-MM-DD */
  inizio: string;
  periodicita: Periodicita;
  importoCent: number;
  /** genera le rate con scadenza <= questa data */
  fino: string;
  /** tetto di sicurezza */
  massimo?: number;
  /** numero della prima rata (per continuare una serie già generata) */
  numeroIniziale?: number;
}

export function generaRate(opzioni: OpzioniRate): RataGenerata[] {
  const passo = MESI_PER_PERIODICITA[opzioni.periodicita];
  const massimo = opzioni.massimo ?? 600;
  const rate: RataGenerata[] = [];
  for (let i = 0; i < massimo; i++) {
    const scadenza = aggiungiMesi(opzioni.inizio, i * passo);
    if (scadenza > opzioni.fino) break;
    rate.push({ scadenza, importoCent: opzioni.importoCent, numero: (opzioni.numeroIniziale ?? 1) + i });
  }
  return rate;
}

/** Importo della rata per un canone annuo dato, secondo la periodicità. */
export function importoRataDaCanoneAnnuo(canoneAnnuoCent: number, periodicita: Periodicita): number {
  return Math.round((canoneAnnuoCent * MESI_PER_PERIODICITA[periodicita]) / 12);
}

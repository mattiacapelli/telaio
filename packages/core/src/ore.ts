import { z } from "zod";
import { aggiungiMesi } from "./rate";

/**
 * Time tracking e contratti a ore («monte ore»): regole pure, senza I/O.
 *
 * Il contratto dà ogni periodo un numero di minuti inclusi. I periodi sono mensili e partono dal
 * giorno di inizio del contratto (dal 15 al 14 del mese dopo); le ore non usate **decadono** a fine
 * periodo, quindi il saldo di un periodo dipende solo dalle voci di quel periodo.
 */

/** Passi di arrotondamento ammessi, in minuti. Si arrotonda sempre per eccesso. */
export const PASSI_ARROTONDAMENTO = [1, 5, 15, 30, 60] as const;
export const ARROTONDAMENTO_PREDEFINITO = 15;

export const STATI_MONTE_ORE = ["attivo", "concluso"] as const;
export type StatoMonteOre = (typeof STATI_MONTE_ORE)[number];
export const ETICHETTE_STATO_MONTE_ORE: Record<StatoMonteOre, string> = {
  attivo: "Attivo",
  concluso: "Concluso",
};

/** Durata massima di una singola voce: un giorno. */
export const MAX_MINUTI_VOCE = 24 * 60;

/** Arrotonda per eccesso al passo (10 min a passo 15 → 15; 0 resta 0). */
export function arrotondaMinuti(minuti: number, passo: number): number {
  if (minuti <= 0) return 0;
  const p = Math.max(1, Math.floor(passo));
  return Math.ceil(minuti / p) * p;
}

/** «7 h 30 min», «45 min», «2 h», «0 min». */
export function formattaOre(minuti: number): string {
  const segno = minuti < 0 ? "−" : "";
  const m = Math.abs(Math.round(minuti));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${segno}${r} min`;
  return r === 0 ? `${segno}${h} h` : `${segno}${h} h ${r} min`;
}

/**
 * Legge una durata scritta a mano, in minuti: «1:30», «1h30», «1h 30m», «90m», «45min»; un numero
 * senza unità vale in **ore** («2» = 2 ore, «1,5» = un'ora e mezza). Null se non si capisce.
 */
export function leggiDurata(testo: string): number | null {
  const t = testo.trim().toLowerCase().replace(/\s+/g, "");
  if (t === "") return null;
  let m = /^(\d{1,3}):([0-5]?\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,3})h(?:(\d{1,2})(?:m|min)?)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,4})(?:m|min)$/.exec(t);
  if (m) return Number(m[1]);
  m = /^(\d{1,3}(?:[.,]\d{1,2})?)$/.exec(t);
  if (m) return Math.round(Number((m[1] as string).replace(",", ".")) * 60);
  return null;
}

const dataIso = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data non valida")
  .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, "Data non valida");

const vuotoNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const intero = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v);

/** Dati di un contratto a ore (senza il cliente). */
export const monteOreDatiSchema = z
  .object({
    nome: z.string().trim().min(1, "Scrivi un nome").max(150, "Al massimo 150 caratteri"),
    minutiIncluse: z.preprocess(
      intero,
      z
        .number("Indica le ore incluse")
        .int()
        .min(1, "Almeno 1 minuto")
        .max(24 * 60 * 31, "Valore troppo grande"),
    ),
    tariffaOrariaCent: z.preprocess(intero, z.number().int().min(0).default(0)),
    tariffaExtraCent: z.preprocess(intero, z.number().int().min(0).default(0)),
    arrotondamentoMinuti: z.preprocess(
      intero,
      z
        .number()
        .refine((n) => (PASSI_ARROTONDAMENTO as readonly number[]).includes(n), "Passo non valido")
        .default(ARROTONDAMENTO_PREDEFINITO),
    ),
    dataInizio: dataIso,
    dataFine: z.preprocess(
      vuotoNull,
      dataIso.nullish().transform((v) => v ?? null),
    ),
  })
  .refine((d) => d.dataFine === null || d.dataFine >= d.dataInizio, {
    path: ["dataFine"],
    message: "La fine non può precedere l'inizio",
  });
export type MonteOreDati = z.infer<typeof monteOreDatiSchema>;

export interface Ciclo {
  /** 0 per il primo periodo */
  n: number;
  /** primo giorno, incluso */
  inizio: string;
  /** ultimo giorno, incluso */
  fine: string;
}

function giornoPrima(data: string): string {
  const d = new Date(`${data}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/** Inizio del periodo `n`: ogni mese lo stesso giorno di `dataInizio` (31 → ultimo giorno nei mesi corti). */
export function inizioCiclo(dataInizio: string, n: number): string {
  return aggiungiMesi(dataInizio, n);
}

/** Il periodo che contiene `data`, oppure null se è prima dell'inizio del contratto. */
export function cicloDi(dataInizio: string, data: string): Ciclo | null {
  if (data < dataInizio) return null;
  const [y1, m1] = dataInizio.split("-").map(Number) as [number, number];
  const [y2, m2] = data.split("-").map(Number) as [number, number];
  let n = y2 * 12 + m2 - (y1 * 12 + m1);
  if (data < inizioCiclo(dataInizio, n)) n -= 1;
  return {
    n,
    inizio: inizioCiclo(dataInizio, n),
    fine: giornoPrima(inizioCiclo(dataInizio, n + 1)),
  };
}

export interface SaldoCiclo extends Ciclo {
  incluse: number;
  usati: number;
  /** può essere negativo: sono le ore extra */
  rimanenti: number;
  /** minuti oltre quelli inclusi */
  extra: number;
  /** 0–100+, per le barre di avanzamento */
  percentuale: number;
}

export function saldoCiclo(ciclo: Ciclo, incluse: number, usati: number): SaldoCiclo {
  return {
    ...ciclo,
    incluse,
    usati,
    rimanenti: incluse - usati,
    extra: Math.max(0, usati - incluse),
    percentuale: incluse > 0 ? Math.round((usati / incluse) * 100) : 0,
  };
}

/**
 * Tutti i periodi del contratto fino a quello di `oggi` (o della fine, se è finito), con le ore
 * usate in ciascuno. `corrente` è il periodo di `oggi` (o l'ultimo, a contratto finito); null se il
 * contratto non è ancora iniziato.
 */
export function storicoMonteOre(
  contratto: { dataInizio: string; dataFine: string | null; minutiIncluse: number },
  voci: { data: string; minuti: number }[],
  oggi: string,
): { corrente: SaldoCiclo | null; cicli: SaldoCiclo[] } {
  const riferimento =
    contratto.dataFine !== null && oggi > contratto.dataFine ? contratto.dataFine : oggi;
  const ultimo = cicloDi(contratto.dataInizio, riferimento);
  if (!ultimo) return { corrente: null, cicli: [] };
  const usati = new Map<number, number>();
  for (const v of voci) {
    const c = cicloDi(contratto.dataInizio, v.data);
    if (c) usati.set(c.n, (usati.get(c.n) ?? 0) + v.minuti);
  }
  const cicli: SaldoCiclo[] = [];
  for (let n = 0; n <= ultimo.n; n++) {
    const inizio = inizioCiclo(contratto.dataInizio, n);
    const fine = giornoPrima(inizioCiclo(contratto.dataInizio, n + 1));
    cicli.push(
      saldoCiclo(
        {
          n,
          inizio,
          fine: contratto.dataFine && contratto.dataFine < fine ? contratto.dataFine : fine,
        },
        contratto.minutiIncluse,
        usati.get(n) ?? 0,
      ),
    );
  }
  return { corrente: cicli[cicli.length - 1] ?? null, cicli };
}

/** Importo delle ore extra, in centesimi: minuti alla tariffa oraria, arrotondato al centesimo. */
export function importoOreExtraCent(minuti: number, tariffaOrariaCent: number): number {
  return Math.round((minuti / 60) * tariffaOrariaCent);
}

/** Soglia oltre la quale il monte si considera in esaurimento (percentuale usata). */
export const SOGLIA_ESAURIMENTO = 80;

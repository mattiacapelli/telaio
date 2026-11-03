import { z } from "zod";
import { calcolaTotali, importoRiga, type RegoleFiscali, type Totali } from "./iva";
import type { Periodicita } from "./rate";

/**
 * Accettazione di un preventivo: regole pure, senza I/O.
 *
 * Il preventivo ha due parti. Le **prestazioni una tantum** si fatturano; gli **abbonamenti**
 * (canone mensile o annuo) diventano abbonamenti con le loro rate. Un canone annuo e uno mensile
 * dello stesso servizio sono **alternative** (stesso `gruppoAlternativaId`): il cliente ne sceglie
 * al più una, e mai si sommano.
 *
 * L'unità di decisione è il «servizio»: una riga indipendente, oppure un gruppo di alternative.
 */

export type TipoRigaPreventivo = "una_tantum" | "canone_annuo" | "canone_mensile";

export interface RigaDecisione {
  id: string;
  tipo: TipoRigaPreventivo;
  quantita: number;
  prezzoUnitarioCent: number;
  scontoBp: number;
  gruppoAlternativaId: string | null;
}

export const PERIODICITA_DA_TIPO: Record<"canone_annuo" | "canone_mensile", Periodicita> = {
  canone_annuo: "annuale",
  canone_mensile: "mensile",
};

export const ETICHETTA_PERIODO: Record<"canone_annuo" | "canone_mensile", string> = {
  canone_annuo: "anno",
  canone_mensile: "mese",
};

export const ricorrente = (tipo: TipoRigaPreventivo): tipo is "canone_annuo" | "canone_mensile" =>
  tipo !== "una_tantum";

/** Un servizio ricorrente: una riga sola, oppure due alternative (annuale e mensile). */
export interface Servizio<T extends RigaDecisione = RigaDecisione> {
  /** id del gruppo, o della riga se è indipendente */
  chiave: string;
  gruppo: boolean;
  righe: T[];
}

/** Servizi in ordine di apparizione: le righe una tantum e quelle indipendenti sono servizi da sole. */
export function servizi<T extends RigaDecisione>(righe: T[]): Servizio<T>[] {
  const out: Servizio<T>[] = [];
  const perGruppo = new Map<string, Servizio<T>>();
  for (const r of righe) {
    if (r.gruppoAlternativaId) {
      let s = perGruppo.get(r.gruppoAlternativaId);
      if (!s) {
        s = { chiave: r.gruppoAlternativaId, gruppo: true, righe: [] };
        perGruppo.set(r.gruppoAlternativaId, s);
        out.push(s);
      }
      s.righe.push(r);
    } else {
      out.push({ chiave: r.id, gruppo: false, righe: [r] });
    }
  }
  return out;
}

/**
 * Struttura dei gruppi di alternative: servono due canoni con periodicità diverse (annuo e mensile),
 * mai una tantum. Ritorna il primo errore, oppure null.
 */
export function erroreGruppi(righe: RigaDecisione[]): string | null {
  const perGruppo = new Map<string, RigaDecisione[]>();
  for (const r of righe)
    if (r.gruppoAlternativaId) {
      const l = perGruppo.get(r.gruppoAlternativaId) ?? [];
      l.push(r);
      perGruppo.set(r.gruppoAlternativaId, l);
    }
  for (const l of perGruppo.values()) {
    if (l.some((r) => r.tipo === "una_tantum"))
      return "Una prestazione una tantum non può essere un'alternativa a un canone";
    if (l.length !== 2 || new Set(l.map((r) => r.tipo)).size !== 2)
      return "Un gruppo di alternative ha un canone annuo e uno mensile dello stesso servizio";
  }
  return null;
}

export const importoDi = (r: RigaDecisione): number =>
  importoRiga({
    quantita: r.quantita,
    prezzoUnitarioCent: r.prezzoUnitarioCent,
    scontoBp: r.scontoBp,
  });

// ── Scelta dell'utente ───────────────────────────────────────────────────────────────────────

/**
 * Cosa decide l'utente alla conferma. `righe` sono le righe indipendenti accettate (una tantum e
 * canoni senza alternativa). `gruppi` ha una voce per ogni gruppo di alternative: l'id della riga
 * scelta, oppure null se il servizio è escluso. Una scelta esplicita per ogni gruppo.
 */
export const sceltaAccettazioneSchema = z.object({
  righe: z.array(z.uuid()).default([]),
  gruppi: z.record(z.uuid(), z.uuid().nullable()).default({}),
});
export type SceltaAccettazione = z.infer<typeof sceltaAccettazioneSchema>;

/** Input dell'accettazione: la scelta e la data di decorrenza degli abbonamenti (di norma oggi). */
export const accettazioneInputSchema = z.object({
  scelta: sceltaAccettazioneSchema,
  decorrenza: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data di decorrenza non valida")
    .optional(),
});
export type AccettazioneInput = z.input<typeof accettazioneInputSchema>;

export type EsitoAccettazione = "accettato" | "accettato_parzialmente" | "rifiutato";

export interface ValutazioneAccettazione {
  esito: EsitoAccettazione;
  /** id riga → accettata; ogni riga del preventivo ha una decisione */
  decisioni: Map<string, boolean>;
  /** servizi accettati ed esclusi, per l'audit e il riepilogo */
  serviziAccettati: number;
  serviziEsclusi: number;
}

export class ErroreAccettazione extends Error {}

/**
 * Valida la scelta contro le righe del preventivo e decide l'esito.
 * - tutti i servizi accettati → `accettato`;
 * - almeno uno accettato e almeno uno escluso → `accettato_parzialmente`;
 * - nessuno accettato → `rifiutato`.
 * Un'alternativa non scelta non è un'esclusione: lo è il servizio rifiutato per intero.
 * Lancia `ErroreAccettazione` per scelte incoerenti (id estranei, due alternative, gruppo senza scelta).
 */
export function valutaAccettazione(
  righe: RigaDecisione[],
  scelta: SceltaAccettazione,
): ValutazioneAccettazione {
  const struttura = erroreGruppi(righe);
  if (struttura) throw new ErroreAccettazione(struttura);
  const perId = new Map(righe.map((r) => [r.id, r]));
  const elenco = servizi(righe);
  const gruppi = elenco.filter((s) => s.gruppo);

  const indipendenti = new Set<string>();
  for (const id of scelta.righe) {
    const r = perId.get(id);
    if (!r) throw new ErroreAccettazione("La selezione contiene righe estranee al preventivo");
    if (r.gruppoAlternativaId)
      throw new ErroreAccettazione(
        "Una riga con alternative si sceglie dal suo gruppo, non singolarmente",
      );
    indipendenti.add(id);
  }

  const scelte = new Map<string, string | null>();
  for (const [gruppoId, rigaId] of Object.entries(scelta.gruppi)) {
    const g = gruppi.find((s) => s.chiave === gruppoId);
    if (!g) throw new ErroreAccettazione("La selezione contiene gruppi estranei al preventivo");
    if (rigaId !== null && !g.righe.some((r) => r.id === rigaId))
      throw new ErroreAccettazione("L'alternativa scelta non appartiene al suo gruppo");
    scelte.set(gruppoId, rigaId);
  }
  for (const g of gruppi)
    if (!scelte.has(g.chiave))
      throw new ErroreAccettazione(
        "Scegli la periodicità di ogni servizio con alternative, oppure escludilo",
      );

  const decisioni = new Map<string, boolean>();
  let accettati = 0;
  let esclusi = 0;
  for (const s of elenco) {
    if (s.gruppo) {
      const scelta = scelte.get(s.chiave) ?? null;
      for (const r of s.righe) decisioni.set(r.id, r.id === scelta);
      if (scelta) accettati++;
      else esclusi++;
    } else {
      const r = s.righe[0] as RigaDecisione;
      const si = indipendenti.has(r.id);
      decisioni.set(r.id, si);
      if (si) accettati++;
      else esclusi++;
    }
  }
  const esito: EsitoAccettazione =
    accettati === 0 ? "rifiutato" : esclusi === 0 ? "accettato" : "accettato_parzialmente";
  return { esito, decisioni, serviziAccettati: accettati, serviziEsclusi: esclusi };
}

/** La scelta «accetta tutto»: valida solo se non ci sono alternative da scegliere. */
export function sceltaTotale(righe: RigaDecisione[]): SceltaAccettazione {
  return {
    righe: righe.filter((r) => !r.gruppoAlternativaId).map((r) => r.id),
    gruppi: Object.fromEntries(
      servizi(righe)
        .filter((s) => s.gruppo)
        .map((s) => [s.chiave, null]),
    ),
  };
}

// ── Importi ──────────────────────────────────────────────────────────────────────────────────

export interface TotaliAccettazione {
  originali: Totali;
  accettati: Totali;
  /** prestazioni una tantum escluse: importo netto */
  escluseCent: number;
}

/**
 * Totali fiscali delle sole prestazioni una tantum: quelli dell'offerta e quelli accettati, con
 * le stesse regole congelate nel preventivo (IVA, bollo, ritenuta, split). I canoni non entrano.
 */
export function totaliAccettazione(
  righe: RigaDecisione[],
  decisioni: Map<string, boolean>,
  regole: RegoleFiscali,
): TotaliAccettazione {
  const unaTantum = righe.filter((r) => r.tipo === "una_tantum");
  const accettate = unaTantum.filter((r) => decisioni.get(r.id) === true);
  const originali = calcolaTotali(unaTantum, regole);
  const accettati = calcolaTotali(accettate, regole);
  return {
    originali,
    accettati,
    escluseCent: originali.imponibileCent - accettati.imponibileCent,
  };
}

/**
 * Valore ricorrente annualizzato: un indicatore informativo, mai un importo fatturabile.
 * Accettato: i soli canoni accettati. Altrimenti: i servizi proposti, con la più economica delle
 * alternative (stima prudente). Il mensile conta dodici volte.
 */
export function valoreRicorrenteAnnuo(
  righe: (RigaDecisione & { accettata?: boolean | null })[],
  accettato: boolean,
): number {
  const annuo = (r: RigaDecisione) =>
    r.tipo === "canone_mensile" ? importoDi(r) * 12 : importoDi(r);
  let tot = 0;
  for (const s of servizi(righe.filter((r) => ricorrente(r.tipo)))) {
    if (accettato) {
      tot += s.righe
        .filter((r) => (r as { accettata?: boolean | null }).accettata === true)
        .reduce((x, r) => x + annuo(r), 0);
    } else {
      tot += Math.min(...s.righe.map(annuo));
    }
  }
  return tot;
}

/** Nome del servizio di un canone: la descrizione senza il suffisso «— canone annuo/mensile». */
export function nomeServizio(descrizione: string): string {
  return descrizione.replace(/\s*[—-]\s*canone (annuo|mensile)\s*$/i, "").trim() || descrizione;
}

// ── Vista dei servizi ricorrenti ─────────────────────────────────────────────────────────────

export interface OpzioneRicorrente {
  rigaId: string;
  tipo: "canone_annuo" | "canone_mensile";
  /** importo per periodo, netto, con quantità e sconto */
  importoCent: number;
  /** nullo finché non c'è una decisione */
  accettata: boolean | null;
}

export interface ServizioRicorrente {
  chiave: string;
  nome: string;
  /** vero se le opzioni sono alternative (annuale oppure mensile) */
  alternative: boolean;
  opzioni: OpzioneRicorrente[];
}

/**
 * I servizi ricorrenti di un preventivo, uno per riga indipendente o per gruppo di alternative.
 * Alimenta dettaglio, tabella e PDF: nessuna somma tra periodicità diverse.
 */
export function serviziRicorrenti(
  righe: (RigaDecisione & { descrizione: string; accettata: boolean | null })[],
): ServizioRicorrente[] {
  return servizi(righe.filter((r) => ricorrente(r.tipo))).map((s) => ({
    chiave: s.chiave,
    nome: nomeServizio(s.righe[0]?.descrizione ?? ""),
    alternative: s.gruppo,
    opzioni: s.righe.map((r) => ({
      rigaId: r.id,
      tipo: r.tipo as "canone_annuo" | "canone_mensile",
      importoCent: importoDi(r),
      accettata: r.accettata,
    })),
  }));
}

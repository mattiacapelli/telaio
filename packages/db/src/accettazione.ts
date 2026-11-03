import {
  type AccettazioneInput,
  accettazioneInputSchema,
  ErroreAccettazione,
  importoDi,
  nomeServizio,
  PERIODICITA_DA_TIPO,
  type RegoleFiscali,
  type RigaDecisione,
  ricorrente,
  type TipoRigaPreventivo,
  totaliAccettazione,
  valutaAccettazione,
} from "@telaio/core";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { generaRateAbbonamenti, oggi } from "./rate-abbonamenti";
import { abbonamenti, preventivi, preventivoRighe } from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

type RigaDb = typeof preventivoRighe.$inferSelect;

const comeDecisione = (r: RigaDb): RigaDecisione => ({
  id: r.id,
  tipo: r.tipo as TipoRigaPreventivo,
  quantita: r.quantita,
  prezzoUnitarioCent: r.prezzoUnitarioCent,
  scontoBp: r.scontoBp,
  gruppoAlternativaId: r.gruppoAlternativaId,
});

export interface EsitoAccettazioneDb {
  stato: "accettato" | "accettato_parzialmente";
  numero: string | null;
  righeAccettate: string[];
  righeEscluse: string[];
  alternativeScelte: { gruppoId: string; rigaId: string }[];
  totaliOriginali: { imponibileCent: number; totaleCent: number };
  totaliAccettati: {
    imponibileCent: number;
    ivaCent: number;
    bolloCent: number;
    totaleCent: number;
  };
  abbonamentiCreati: string[];
  decorrenza: string;
  /** falso se le rate non si sono potute generare subito: le completa il job giornaliero */
  rateGenerate: boolean;
}

/** Un abbonamento per ogni riga ricorrente accettata; il vincolo univoco sulla riga evita i doppioni. */
async function creaAbbonamentiDelle(
  tx: Tx,
  p: { id: string; ragioneSocialeId: string; clienteRefId: string | null },
  righe: RigaDb[],
  decorrenza: string,
): Promise<string[]> {
  const ricorrenti = righe.filter((r) => ricorrente(r.tipo as TipoRigaPreventivo));
  if (ricorrenti.length === 0) return [];
  if (!p.clienteRefId)
    throw new Error("Assegna un cliente al preventivo prima di attivare gli abbonamenti");
  const creati = await tx
    .insert(abbonamenti)
    .values(
      ricorrenti.map((r) => ({
        ragioneSocialeId: p.ragioneSocialeId,
        clienteRefId: p.clienteRefId as string,
        preventivoId: p.id,
        preventivoRigaId: r.id,
        descrizione: nomeServizio(r.descrizione),
        periodicita: PERIODICITA_DA_TIPO[r.tipo as "canone_annuo" | "canone_mensile"],
        importoRataCent: importoDi(comeDecisione(r)),
        inizio: decorrenza,
      })),
    )
    .onConflictDoNothing({ target: abbonamenti.preventivoRigaId })
    .returning({ id: abbonamenti.id });
  return creati.map((c) => c.id);
}

async function generaRate(db: Database, ids: string[]): Promise<boolean> {
  try {
    for (const id of ids) await generaRateAbbonamenti(db, { abbonamentoId: id });
    return true;
  } catch {
    return false;
  }
}

function controllaDecorrenza(decorrenza: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(decorrenza) || Number.isNaN(Date.parse(decorrenza)))
    throw new Error("Data di decorrenza non valida");
  if (decorrenza < oggi())
    throw new Error("La decorrenza degli abbonamenti non può essere nel passato");
}

/**
 * Accetta un preventivo inviato o in revisione, in modo totale o parziale, in una sola transazione:
 * decide ogni riga, ricalcola i totali sulle sole prestazioni una tantum accettate (senza toccare
 * l'offerta originale) e crea gli abbonamenti dei canoni accettati. Il preventivo è bloccato per
 * tutta la durata, quindi due richieste concorrenti non accettano né creano abbonamenti due volte:
 * la seconda trova il preventivo già accettato. Le rate si generano subito dopo, in modo idempotente.
 */
export async function accettaPreventivo(
  db: Database,
  preventivoId: string,
  input: AccettazioneInput,
): Promise<EsitoAccettazioneDb> {
  const dati = accettazioneInputSchema.parse(input);
  const decorrenza = dati.decorrenza ?? oggi();
  controllaDecorrenza(decorrenza);

  const esito = await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, preventivoId), isNull(preventivi.deletedAt)))
      .for("update");
    if (!p) throw new Error("Preventivo non trovato");
    if (p.stato !== "inviato" && p.stato !== "in_revisione")
      throw new Error(
        p.stato === "bozza"
          ? "Invia il preventivo prima di registrarne l'accettazione"
          : "Il preventivo è già stato chiuso: l'accettazione non si può più cambiare",
      );

    const righe = await tx
      .select()
      .from(preventivoRighe)
      .where(eq(preventivoRighe.preventivoId, p.id))
      .orderBy(asc(preventivoRighe.posizione));
    const decisioni = righe.map(comeDecisione);
    let valutazione: ReturnType<typeof valutaAccettazione>;
    try {
      valutazione = valutaAccettazione(decisioni, dati.scelta);
    } catch (e) {
      if (e instanceof ErroreAccettazione) throw new Error(e.message);
      throw e;
    }
    if (valutazione.esito === "rifiutato")
      throw new Error("Nessuna prestazione accettata: rifiuta il preventivo");

    const regole = p.snapshot.regole as unknown as RegoleFiscali;
    const t = totaliAccettazione(decisioni, valutazione.decisioni, regole);

    const accettate = righe.filter((r) => valutazione.decisioni.get(r.id) === true);
    const abbonamentiCreati = await creaAbbonamentiDelle(tx, p, accettate, decorrenza);

    for (const r of righe)
      await tx
        .update(preventivoRighe)
        .set({ accettata: valutazione.decisioni.get(r.id) === true })
        .where(eq(preventivoRighe.id, r.id));
    await tx
      .update(preventivi)
      .set({
        stato: valutazione.esito,
        imponibileAccettatoCent: t.accettati.imponibileCent,
        ivaAccettataCent: t.accettati.ivaCent,
        bolloAccettatoCent: t.accettati.bolloCent,
        totaleAccettatoCent: t.accettati.totaleCent,
        dataAccettazione: new Date(),
      })
      .where(eq(preventivi.id, p.id));

    const gruppi = new Map<string, string>();
    for (const r of accettate) if (r.gruppoAlternativaId) gruppi.set(r.gruppoAlternativaId, r.id);
    return {
      stato: valutazione.esito,
      numero: p.numero,
      righeAccettate: accettate.map((r) => r.id),
      righeEscluse: righe.filter((r) => !valutazione.decisioni.get(r.id)).map((r) => r.id),
      alternativeScelte: [...gruppi].map(([gruppoId, rigaId]) => ({ gruppoId, rigaId })),
      totaliOriginali: {
        imponibileCent: t.originali.imponibileCent,
        totaleCent: t.originali.totaleCent,
      },
      totaliAccettati: {
        imponibileCent: t.accettati.imponibileCent,
        ivaCent: t.accettati.ivaCent,
        bolloCent: t.accettati.bolloCent,
        totaleCent: t.accettati.totaleCent,
      },
      abbonamentiCreati,
      decorrenza,
    };
  });
  const rateGenerate = await generaRate(db, esito.abbonamentiCreati);
  return { ...esito, rateGenerate } as EsitoAccettazioneDb;
}

/**
 * Crea gli abbonamenti mancanti dei canoni accettati di un preventivo e genera le rate: serve a
 * recuperare un'accettazione interrotta e, di proposito e a mano, a coprire i preventivi accettati
 * prima di questa funzione (la migrazione non crea abbonamenti storici). Idempotente.
 */
export async function completaAbbonamentiPreventivo(
  db: Database,
  preventivoId: string,
  decorrenza: string = oggi(),
): Promise<{ abbonamentiCreati: string[]; rateGenerate: boolean }> {
  controllaDecorrenza(decorrenza);
  const creati = await db.transaction(async (tx) => {
    const [p] = await tx
      .select()
      .from(preventivi)
      .where(and(eq(preventivi.id, preventivoId), isNull(preventivi.deletedAt)))
      .for("update");
    if (!p) throw new Error("Preventivo non trovato");
    if (p.stato !== "accettato" && p.stato !== "accettato_parzialmente")
      throw new Error("Il preventivo non è stato accettato");
    const righe = await tx
      .select()
      .from(preventivoRighe)
      .where(and(eq(preventivoRighe.preventivoId, p.id), eq(preventivoRighe.accettata, true)));
    return creaAbbonamentiDelle(tx, p, righe, decorrenza);
  });
  // Anche gli abbonamenti già esistenti ma senza rate (generazione fallita) si completano qui.
  const esistenti = await db
    .select({ id: abbonamenti.id })
    .from(abbonamenti)
    .where(and(eq(abbonamenti.preventivoId, preventivoId), isNull(abbonamenti.deletedAt)));
  const rateGenerate = await generaRate(
    db,
    esistenti.map((a) => a.id),
  );
  return { abbonamentiCreati: creati, rateGenerate };
}

import {
  abbonamenti,
  and,
  type Database,
  eq,
  fatture,
  gt,
  incassi,
  isNull,
  movimenti,
  rate,
  sql,
} from "@telaio/db";
import { z } from "zod";
import { dataValida, oggi, reData } from "../date";
import { modificaDataIncasso } from "./incassi";
import { registraMovimentoSchema } from "./movimenti";

/**
 * Modifiche e cancellazioni di incassi, movimenti, abbonamenti e rate: quello che il server MCP
 * aggiunge a «registra» e «crea». Ogni operazione tiene allineati i dati collegati (prima nota,
 * stato di rate e fatture).
 */

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Riporta lo stato di una rata e di una fattura a ciò che dicono gli incassi rimasti. */
async function riallinea(tx: Tx, link: { rataId: string | null; fatturaId: string | null }) {
  if (link.rataId) {
    const [{ tot } = { tot: 0 }] = await tx
      .select({ tot: sql<number>`coalesce(sum(${incassi.importoCent}),0)::int` })
      .from(incassi)
      .where(and(eq(incassi.rataId, link.rataId), isNull(incassi.deletedAt)));
    const [r] = await tx.select().from(rate).where(eq(rate.id, link.rataId));
    if (r && r.stato !== "annullata") {
      const stato =
        tot >= r.importoCent
          ? "incassata"
          : tot > 0
            ? "parziale"
            : r.scadenza < oggi()
              ? "scaduta"
              : "da_incassare";
      await tx.update(rate).set({ stato }).where(eq(rate.id, r.id));
    }
  }
  if (link.fatturaId) {
    const [{ tot } = { tot: 0 }] = await tx
      .select({ tot: sql<number>`coalesce(sum(${incassi.importoCent}),0)::int` })
      .from(incassi)
      .where(and(eq(incassi.fatturaId, link.fatturaId), isNull(incassi.deletedAt)));
    const [f] = await tx.select().from(fatture).where(eq(fatture.id, link.fatturaId));
    if (f && f.stato !== "bozza") {
      const stato =
        tot >= f.nettoDaPagareCent
          ? "pagata"
          : tot > 0
            ? "parzialmente_pagata"
            : f.sdiIdentificativo
              ? "inviata_sdi"
              : "emessa";
      await tx.update(fatture).set({ stato }).where(eq(fatture.id, f.id));
    }
  }
}

// ── Incassi ──────────────────────────────────────────────────────────────────────────────────

export const incassoModificaSchema = z.object({
  data: z.string().regex(reData, "Data non valida"),
  importoCent: z.number().int().positive("L'importo deve essere maggiore di zero"),
  contoId: z.uuid(),
  descrizione: z.string().trim().max(500).nullish(),
  riferimento: z.string().trim().max(200).nullish(),
});

/** Cambia data, importo, conto, descrizione o riferimento di un incasso, con il suo movimento e gli stati collegati. */
export async function modificaIncasso(db: Database, id: string, input: unknown) {
  const dati = incassoModificaSchema.partial().parse(input);
  if (dati.data && !dataValida(dati.data)) throw new Error("Data non valida");
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  await db.transaction(async (tx) => {
    const [i] = await tx
      .select()
      .from(incassi)
      .where(and(eq(incassi.id, id), isNull(incassi.deletedAt)))
      .for("update");
    if (!i) throw new Error("Incasso non trovato");
    const descrizione = dati.descrizione === undefined ? i.descrizione : dati.descrizione || null;
    await tx
      .update(incassi)
      .set({
        ...(dati.data && { data: dati.data }),
        ...(dati.importoCent && { importoCent: dati.importoCent }),
        ...(dati.contoId && { contoId: dati.contoId }),
        descrizione,
        ...(dati.riferimento !== undefined && { riferimento: dati.riferimento || null }),
      })
      .where(eq(incassi.id, id));
    await tx
      .update(movimenti)
      .set({
        ...(dati.data && { data: dati.data }),
        ...(dati.importoCent && { importoCent: dati.importoCent }),
        ...(dati.contoId && { contoId: dati.contoId }),
        descrizione: descrizione || "Incasso",
      })
      .where(eq(movimenti.incassoId, id));
    await riallinea(tx, { rataId: i.rataId, fatturaId: i.fatturaId });
  });
  return { id };
}

/** Elimina l'incasso e il suo movimento di prima nota; rata e fattura tornano com'erano senza di lui. */
export async function eliminaIncasso(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [i] = await tx
      .select()
      .from(incassi)
      .where(and(eq(incassi.id, id), isNull(incassi.deletedAt)))
      .for("update");
    if (!i) throw new Error("Incasso non trovato");
    const ora = new Date();
    await tx.update(incassi).set({ deletedAt: ora }).where(eq(incassi.id, id));
    await tx.update(movimenti).set({ deletedAt: ora }).where(eq(movimenti.incassoId, id));
    await riallinea(tx, { rataId: i.rataId, fatturaId: i.fatturaId });
  });
  return { id, eliminato: true };
}

export { modificaDataIncasso };

// ── Movimenti di prima nota ──────────────────────────────────────────────────────────────────

export const movimentoModificaSchema = z.object({
  tipo: z.enum(["entrata", "uscita", "giroconto"]),
  data: z.string().regex(reData, "Data non valida"),
  importoCent: z.number().int().positive("L'importo deve essere maggiore di zero"),
  contoId: z.uuid(),
  contoDestinazioneId: z.uuid().nullish(),
  categoria: z.string().trim().max(100).nullish(),
  descrizione: z.string().trim().max(500).nullish(),
});

const MOVIMENTO_DA_INCASSO = "Questo movimento nasce da un incasso: modifica o elimina l'incasso";

/** Solo i movimenti inseriti a mano: quelli nati da un incasso seguono l'incasso. */
export async function modificaMovimento(db: Database, id: string, input: unknown) {
  const patch = movimentoModificaSchema.partial().parse(input);
  await db.transaction(async (tx) => {
    const [m] = await tx
      .select()
      .from(movimenti)
      .where(and(eq(movimenti.id, id), isNull(movimenti.deletedAt)))
      .for("update");
    if (!m) throw new Error("Movimento non trovato");
    if (m.incassoId) throw new Error(MOVIMENTO_DA_INCASSO);
    const v = registraMovimentoSchema.parse({
      tipo: patch.tipo ?? m.tipo,
      data: patch.data ?? m.data,
      importoCent: patch.importoCent ?? m.importoCent,
      contoId: patch.contoId ?? m.contoId,
      contoDestinazioneId:
        patch.contoDestinazioneId === undefined ? m.contoDestinazioneId : patch.contoDestinazioneId,
      categoria: patch.categoria === undefined ? m.categoria : patch.categoria,
      descrizione: patch.descrizione === undefined ? m.descrizione : patch.descrizione,
    });
    if (!dataValida(v.data)) throw new Error("Data non valida");
    await tx
      .update(movimenti)
      .set({
        tipo: v.tipo,
        data: v.data,
        importoCent: v.importoCent,
        contoId: v.contoId,
        contoDestinazioneId: v.tipo === "giroconto" ? (v.contoDestinazioneId ?? null) : null,
        categoria: v.categoria || null,
        descrizione: v.descrizione || null,
      })
      .where(eq(movimenti.id, id));
  });
  return { id };
}

export async function eliminaMovimento(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [m] = await tx
      .select()
      .from(movimenti)
      .where(and(eq(movimenti.id, id), isNull(movimenti.deletedAt)))
      .for("update");
    if (!m) throw new Error("Movimento non trovato");
    if (m.incassoId) throw new Error(MOVIMENTO_DA_INCASSO);
    await tx.update(movimenti).set({ deletedAt: new Date() }).where(eq(movimenti.id, id));
  });
  return { id, eliminato: true };
}

// ── Abbonamenti ──────────────────────────────────────────────────────────────────────────────

export const abbonamentoModificaSchema = z.object({
  descrizione: z.string().trim().min(1, "Inserisci una descrizione").max(300),
  importoRataCent: z.number().int().positive("L'importo della rata deve essere maggiore di zero"),
  fine: z.string().regex(reData, "Data non valida").nullable(),
});

/**
 * Cambia descrizione, importo della rata o fine. Il nuovo importo vale per le rate future ancora
 * da incassare; con una fine anticipata si annullano quelle oltre la fine. Le rate già incassate
 * o scadute restano com'erano.
 */
export async function modificaAbbonamento(db: Database, id: string, input: unknown) {
  const dati = abbonamentoModificaSchema.partial().parse(input);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  if (dati.fine && !dataValida(dati.fine)) throw new Error("Data non valida");
  const dataOggi = oggi();
  await db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(abbonamenti)
      .where(and(eq(abbonamenti.id, id), isNull(abbonamenti.deletedAt)))
      .for("update");
    if (!a) throw new Error("Abbonamento non trovato");
    if (dati.fine && dati.fine < a.inizio) throw new Error("La fine non può precedere l'inizio");
    await tx.update(abbonamenti).set(dati).where(eq(abbonamenti.id, id));
    if (dati.importoRataCent)
      await tx
        .update(rate)
        .set({ importoCent: dati.importoRataCent })
        .where(
          and(
            eq(rate.abbonamentoId, id),
            eq(rate.stato, "da_incassare"),
            gt(rate.scadenza, dataOggi),
          ),
        );
    if (dati.fine)
      await tx
        .update(rate)
        .set({ stato: "annullata" })
        .where(
          and(
            eq(rate.abbonamentoId, id),
            eq(rate.stato, "da_incassare"),
            gt(rate.scadenza, dati.fine),
          ),
        );
  });
  return { id };
}

/** L'abbonamento sparisce dagli elenchi e cessa: le rate future da incassare si annullano, il resto resta. */
export async function eliminaAbbonamento(db: Database, id: string) {
  const dataOggi = oggi();
  await db.transaction(async (tx) => {
    const [a] = await tx
      .select()
      .from(abbonamenti)
      .where(and(eq(abbonamenti.id, id), isNull(abbonamenti.deletedAt)))
      .for("update");
    if (!a) throw new Error("Abbonamento non trovato");
    await tx
      .update(abbonamenti)
      .set({ deletedAt: new Date(), stato: "cessato" })
      .where(eq(abbonamenti.id, id));
    await tx
      .update(rate)
      .set({ stato: "annullata" })
      .where(
        and(
          eq(rate.abbonamentoId, id),
          eq(rate.stato, "da_incassare"),
          gt(rate.scadenza, dataOggi),
        ),
      );
  });
  return { id, eliminato: true };
}

// ── Rate ─────────────────────────────────────────────────────────────────────────────────────

export const rataModificaSchema = z.object({
  descrizione: z.string().trim().min(1).max(300),
  scadenza: z.string().regex(reData, "Data non valida"),
  importoCent: z.number().int().positive("L'importo deve essere maggiore di zero"),
});

/**
 * Cambia descrizione, scadenza o importo di una rata. La rata di una fattura segue la fattura: le
 * sue date si cambiano con `modifica_date_fattura`.
 */
export async function modificaRata(db: Database, id: string, input: unknown) {
  const dati = rataModificaSchema.partial().parse(input);
  if (Object.keys(dati).length === 0) throw new Error("Nessun campo da modificare");
  if (dati.scadenza && !dataValida(dati.scadenza)) throw new Error("Data non valida");
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(rate).where(eq(rate.id, id)).for("update");
    if (!r) throw new Error("Rata non trovata");
    if (r.stato === "annullata") throw new Error("La rata è annullata");
    if (r.fatturaId && (dati.scadenza || dati.importoCent))
      throw new Error(
        "La rata appartiene a una fattura: cambia le date con modifica_date_fattura; l'importo segue la fattura",
      );
    await tx.update(rate).set(dati).where(eq(rate.id, id));
    const [r2] = await tx.select().from(rate).where(eq(rate.id, id));
    if (r2 && (r2.stato === "da_incassare" || r2.stato === "scaduta") && dati.scadenza)
      await tx
        .update(rate)
        .set({ stato: r2.scadenza < oggi() ? "scaduta" : "da_incassare" })
        .where(eq(rate.id, id));
    await riallinea(tx, { rataId: id, fatturaId: null });
  });
  return { id };
}

/** Annulla una rata che non ha incassi: esce dallo scadenzario e dai solleciti. */
export async function annullaRata(db: Database, id: string) {
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(rate).where(eq(rate.id, id)).for("update");
    if (!r) throw new Error("Rata non trovata");
    if (r.stato === "annullata") throw new Error("La rata è già annullata");
    if (r.fatturaId) throw new Error("La rata appartiene a una fattura: annulla la fattura");
    const [{ n } = { n: 0 }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(incassi)
      .where(and(eq(incassi.rataId, id), isNull(incassi.deletedAt)));
    if (n > 0) throw new Error("La rata ha incassi registrati: eliminali prima");
    await tx.update(rate).set({ stato: "annullata" }).where(eq(rate.id, id));
  });
  return { id, annullata: true };
}

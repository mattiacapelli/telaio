import {
  and,
  conti,
  type Database,
  eq,
  fatture,
  incassi,
  isNull,
  movimenti,
  rate,
  sql,
} from "@telaio/db";
import { z } from "zod";
import { reData } from "../date";

export const registraIncassoSchema = z.object({
  contoId: z.uuid("Scegli il conto"),
  data: z.string().regex(reData, "Data non valida"),
  importoCent: z.number().int().positive("L'importo deve essere maggiore di zero"),
  rataId: z.uuid().nullish(),
  fatturaId: z.uuid().nullish(),
  descrizione: z.string().trim().nullish(),
  riferimento: z.string().trim().nullish(),
});
export type RegistraIncassoInput = z.infer<typeof registraIncassoSchema>;

/**
 * Registra un incasso e il relativo movimento di prima nota (entrata) nella stessa transazione,
 * poi riallinea lo stato di rata e fattura collegate. Un incasso può essere libero.
 */
export async function registraIncasso(db: Database, input: RegistraIncassoInput) {
  const dati = registraIncassoSchema.parse(input);
  return db.transaction(async (tx) => {
    const [conto] = await tx
      .select()
      .from(conti)
      .where(and(eq(conti.id, dati.contoId), isNull(conti.deletedAt)));
    if (!conto) throw new Error("Conto non trovato");

    let ragioneSocialeId: string | null = conto.ragioneSocialeId;
    let clienteRefId: string | null = null;
    let fatturaId = dati.fatturaId ?? null;
    let rataId = dati.rataId ?? null;

    if (dati.rataId) {
      const [r] = await tx.select().from(rate).where(eq(rate.id, dati.rataId)).for("update");
      if (!r) throw new Error("Rata non trovata");
      if (r.stato === "annullata") throw new Error("La rata è annullata");
      ragioneSocialeId = r.ragioneSocialeId;
      clienteRefId = r.clienteRefId;
      fatturaId ??= r.fatturaId;
    }
    if (fatturaId) {
      const [f] = await tx.select().from(fatture).where(eq(fatture.id, fatturaId)).for("update");
      if (!f || f.deletedAt) throw new Error("Fattura non trovata");
      if (f.stato === "bozza") throw new Error("La fattura non è ancora emessa");
      ragioneSocialeId = f.ragioneSocialeId;
      clienteRefId ??= f.clienteRefId;
      // un incasso sulla fattura salda anche la sua rata nello scadenzario
      rataId ??= f.rataId;
    }

    const [incasso] = await tx
      .insert(incassi)
      .values({
        contoId: dati.contoId,
        ragioneSocialeId,
        clienteRefId,
        rataId,
        fatturaId,
        data: dati.data,
        importoCent: dati.importoCent,
        descrizione: dati.descrizione || null,
        riferimento: dati.riferimento || null,
      })
      .returning();
    if (!incasso) throw new Error("Registrazione incasso fallita");

    await tx.insert(movimenti).values({
      tipo: "entrata",
      data: dati.data,
      importoCent: dati.importoCent,
      contoId: dati.contoId,
      categoria: "incasso",
      descrizione: dati.descrizione || "Incasso",
      incassoId: incasso.id,
    });

    if (rataId) {
      const [{ tot } = { tot: 0 }] = await tx
        .select({ tot: sql<number>`coalesce(sum(${incassi.importoCent}),0)::int` })
        .from(incassi)
        .where(and(eq(incassi.rataId, rataId), isNull(incassi.deletedAt)));
      const [r] = await tx.select().from(rate).where(eq(rate.id, rataId));
      if (r)
        await tx
          .update(rate)
          .set({ stato: tot >= r.importoCent ? "incassata" : "parziale" })
          .where(eq(rate.id, r.id));
    }
    if (fatturaId) {
      const [{ tot } = { tot: 0 }] = await tx
        .select({ tot: sql<number>`coalesce(sum(${incassi.importoCent}),0)::int` })
        .from(incassi)
        .where(and(eq(incassi.fatturaId, fatturaId), isNull(incassi.deletedAt)));
      const [f] = await tx.select().from(fatture).where(eq(fatture.id, fatturaId));
      if (f) {
        await tx
          .update(fatture)
          .set({ stato: tot >= f.nettoDaPagareCent ? "pagata" : "parzialmente_pagata" })
          .where(eq(fatture.id, f.id));
      }
    }
    return incasso;
  });
}

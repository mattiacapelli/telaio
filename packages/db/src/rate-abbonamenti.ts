import { aggiungiMesi, generaRate, type Periodicita } from "@telaio/core";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Database } from "./client";
import { abbonamenti, rate } from "./schema";

export const ORIZZONTE_MESI = 12;

export function oggi(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Rome" }).format(new Date());
}

/**
 * Genera le rate degli abbonamenti attivi fino a `oggi + 12 mesi` e marca come scadute
 * le rate non incassate con scadenza passata. È idempotente: l'indice univoco
 * (abbonamento_id, scadenza) impedisce rate doppie anche se gira due volte.
 * Con `abbonamentoId` lavora su un solo abbonamento (usato alla creazione).
 */
export async function generaRateAbbonamenti(
  db: Database,
  opzioni: { dataOggi?: string; abbonamentoId?: string } = {},
) {
  const dataOggi = opzioni.dataOggi ?? oggi();
  const orizzonte = aggiungiMesi(dataOggi, ORIZZONTE_MESI);
  const filtro = [eq(abbonamenti.stato, "attivo"), isNull(abbonamenti.deletedAt)];
  if (opzioni.abbonamentoId) filtro.push(eq(abbonamenti.id, opzioni.abbonamentoId));
  const attivi = await db
    .select()
    .from(abbonamenti)
    .where(and(...filtro));

  let create = 0;
  for (const ab of attivi) {
    const fino = ab.fine && ab.fine < orizzonte ? ab.fine : orizzonte;
    const nuove = generaRate({
      inizio: ab.inizio,
      periodicita: ab.periodicita as Periodicita,
      importoCent: ab.importoRataCent,
      fino,
    });
    if (nuove.length === 0) continue;
    const inserite = await db
      .insert(rate)
      .values(
        nuove.map((r) => ({
          abbonamentoId: ab.id,
          ragioneSocialeId: ab.ragioneSocialeId,
          clienteRefId: ab.clienteRefId,
          numero: r.numero,
          descrizione: `${ab.descrizione} — rata ${r.numero}`,
          scadenza: r.scadenza,
          importoCent: r.importoCent,
        })),
      )
      .onConflictDoNothing({ target: [rate.abbonamentoId, rate.scadenza] })
      .returning({ id: rate.id });
    create += inserite.length;
    await db.update(abbonamenti).set({ rateGenerateFino: fino }).where(eq(abbonamenti.id, ab.id));
  }

  const scadute = await db
    .update(rate)
    .set({ stato: "scaduta" })
    .where(and(eq(rate.stato, "da_incassare"), sql`${rate.scadenza} < ${dataOggi}`))
    .returning({ id: rate.id });

  return { abbonamenti: attivi.length, rateCreate: create, rateScadute: scadute.length };
}

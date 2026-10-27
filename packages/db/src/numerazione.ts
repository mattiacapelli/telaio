import { formattaNumero } from "@telaio/core";
import { sql } from "drizzle-orm";
import type { Database } from "./client";
import { numerazioni } from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

/**
 * Assegna il prossimo numero in modo atomico: l'UPSERT blocca la riga del contatore
 * fino al commit, quindi due richieste concorrenti non ottengono mai lo stesso numero.
 * Chiamarla nella stessa transazione che scrive il documento: se questa fallisce,
 * il contatore torna indietro e non restano buchi.
 */
export async function assegnaNumero(
  tx: Tx,
  opzioni: {
    ragioneSocialeId: string;
    tipo: "preventivo" | "fattura";
    anno: number;
    formato: string;
  },
): Promise<{ numero: string; progressivo: number }> {
  const [riga] = await tx
    .insert(numerazioni)
    .values({
      ragioneSocialeId: opzioni.ragioneSocialeId,
      tipo: opzioni.tipo,
      anno: opzioni.anno,
      ultimo: 1,
    })
    .onConflictDoUpdate({
      target: [numerazioni.ragioneSocialeId, numerazioni.tipo, numerazioni.anno],
      set: { ultimo: sql`${numerazioni.ultimo} + 1` },
    })
    .returning({ ultimo: numerazioni.ultimo });
  if (!riga) throw new Error("Assegnazione numero fallita");
  return {
    numero: formattaNumero(opzioni.formato, riga.ultimo, opzioni.anno),
    progressivo: riga.ultimo,
  };
}

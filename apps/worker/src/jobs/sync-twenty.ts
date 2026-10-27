import { clientiRef, type Database, eq, isNull, sql } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";

/**
 * Riallinea i riferimenti locali ai clienti con i dati attuali su Twenty (nome, P.IVA, PEC, SDI…).
 * La fonte di verità resta Twenty: qui si copia soltanto, non si scrive mai verso Twenty.
 */
export async function sincronizzaTwenty(db: Database) {
  const twenty = twentyDaEnv();
  if (twenty.finto) return { saltato: true, motivo: "Twenty non collegato (TWENTY_API_URL vuoto)" };

  const riferimenti = await db
    .select({ id: clientiRef.id, twentyId: clientiRef.twentyCompanyId })
    .from(clientiRef)
    .where(isNull(clientiRef.deletedAt));

  let aggiornati = 0;
  let mancanti = 0;
  let errori = 0;
  for (const r of riferimenti) {
    if (!r.twentyId) continue;
    try {
      const c = await twenty.dettaglioCliente(r.twentyId);
      if (!c) {
        mancanti++;
        continue;
      }
      await db
        .update(clientiRef)
        .set({
          nome: c.nome,
          partitaIva: c.partitaIva,
          codiceFiscale: c.codiceFiscale,
          pec: c.pec,
          codiceSdi: c.codiceSdi,
          pa: c.pa,
          lastSyncedAt: sql`now()`,
        })
        .where(eq(clientiRef.id, r.id));
      aggiornati++;
    } catch {
      errori++;
    }
  }
  return { riferimenti: riferimenti.length, aggiornati, mancanti, errori };
}

import { clientiRef, type Database } from "@telaio/db";
import { twentyDaEnv } from "@telaio/twenty";

/**
 * Risolve un cliente di Twenty in un riferimento locale (`clienti_ref`, con upsert): la fonte di
 * verità dell'anagrafica resta Twenty. Ritorna anche i dati letti, utili per congelarli in un documento.
 */
export async function risolviClienteRef(
  db: Database,
  twentyCompanyId: string,
): Promise<{ id: string; cliente: Record<string, unknown> }> {
  const cliente = await twentyDaEnv().dettaglioCliente(twentyCompanyId);
  if (!cliente) throw new Error("Cliente non trovato su Twenty");
  const valori = {
    twentyCompanyId: cliente.id,
    nome: cliente.nome,
    partitaIva: cliente.partitaIva,
    codiceFiscale: cliente.codiceFiscale,
    pec: cliente.pec,
    codiceSdi: cliente.codiceSdi,
    pa: cliente.pa,
    lastSyncedAt: new Date(),
  };
  const [ref] = await db
    .insert(clientiRef)
    .values(valori)
    .onConflictDoUpdate({ target: clientiRef.twentyCompanyId, set: valori })
    .returning({ id: clientiRef.id });
  if (!ref) throw new Error("Cliente non salvato");
  return { id: ref.id, cliente: { ...cliente } };
}

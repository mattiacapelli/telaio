import { type Database, eq, impostazioni } from "@telaio/db";

export const CHIAVE_TICKET = "ticket";

export interface TicketImpostazioni {
  /** i ticket nuovi, senza altra scelta, vanno a chi li crea */
  autoAssegna: boolean;
}

export async function leggiTicketImpostazioni(
  db: Pick<Database, "select">,
): Promise<TicketImpostazioni> {
  const [r] = await db.select().from(impostazioni).where(eq(impostazioni.chiave, CHIAVE_TICKET));
  const v = (r?.valore ?? {}) as Partial<TicketImpostazioni>;
  return { autoAssegna: v.autoAssegna === true };
}

export async function salvaTicketImpostazioni(db: Database, valori: TicketImpostazioni) {
  await db
    .insert(impostazioni)
    .values({ chiave: CHIAVE_TICKET, valore: valori })
    .onConflictDoUpdate({
      target: impostazioni.chiave,
      set: { valore: valori, updatedAt: new Date() },
    });
}

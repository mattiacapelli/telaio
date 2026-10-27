import { auditLog, type Database } from "@telaio/db";

export async function audit(
  db: Database,
  voce: {
    userId?: string;
    apiKeyId?: string;
    azione: string;
    entita?: string;
    entitaId?: string;
    dettagli?: unknown;
  },
) {
  await db.insert(auditLog).values(voce);
}

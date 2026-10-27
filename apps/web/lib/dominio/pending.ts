import { and, type Database, eq, pendingActions } from "@telaio/db";
import { audit } from "../audit";
import { eseguiStrumento } from "../mcp/esegui";

/**
 * Una pending_action esegue solo qui, dopo la conferma esplicita dell'admin: lo strumento MCP
 * proposto gira con i parametri salvati al momento della proposta.
 */
export async function proponiAzione(
  db: Database,
  azione: { tipo: string; payload: unknown; apiKeyId?: string; origine?: string },
) {
  const [riga] = await db
    .insert(pendingActions)
    .values({
      tipo: azione.tipo,
      payload: azione.payload,
      apiKeyId: azione.apiKeyId,
      origine: azione.origine ?? "mcp",
    })
    .returning({ id: pendingActions.id });
  return riga;
}

export async function confermaAzione(db: Database, id: string, userId: string) {
  // Il cambio di stato è condizionato: una doppia conferma non esegue due volte.
  const [azione] = await db
    .update(pendingActions)
    .set({ stato: "confermata", resolvedAt: new Date(), resolvedBy: userId })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.stato, "in_attesa")))
    .returning();
  if (!azione) return { ok: false as const, errore: "Azione già gestita o inesistente" };

  try {
    const risultato = await eseguiStrumento(db, azione.tipo, azione.payload);
    await db
      .update(pendingActions)
      .set({ risultato: (risultato ?? null) as object })
      .where(eq(pendingActions.id, id));
    await audit(db, {
      userId,
      azione: `pending.${azione.tipo}.confermata`,
      entita: "pending_actions",
      entitaId: id,
    });
    return { ok: true as const, risultato };
  } catch (e) {
    const messaggio = e instanceof Error ? e.message : "Errore sconosciuto";
    await db
      .update(pendingActions)
      .set({ stato: "fallita", errore: messaggio })
      .where(eq(pendingActions.id, id));
    return { ok: false as const, errore: messaggio };
  }
}

export async function rifiutaAzione(db: Database, id: string, userId: string) {
  await db
    .update(pendingActions)
    .set({ stato: "rifiutata", resolvedAt: new Date(), resolvedBy: userId })
    .where(and(eq(pendingActions.id, id), eq(pendingActions.stato, "in_attesa")));
  await audit(db, { userId, azione: "pending.rifiutata", entita: "pending_actions", entitaId: id });
}

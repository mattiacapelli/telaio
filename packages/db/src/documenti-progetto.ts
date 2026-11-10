import { type CategoriaDocumento, documentoDatiSchema } from "@telaio/core";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Database } from "./client";
import { progetti, progettoDocumenti, ticket, users } from "./schema";

export interface NuovoDocumento {
  id: string;
  progettoId: string;
  ticketId?: string | null;
  nome: string;
  chiave: string;
  dimensioneByte: number;
  tipoMime?: string;
  categoria?: CategoriaDocumento | string;
  descrizione?: string | null;
  caricatoDaId?: string | null;
}

/**
 * Registra un documento già caricato nel bucket. Il ticket, se c'è, deve essere del progetto.
 * Se fallisce, chi chiama toglie l'oggetto dal bucket.
 */
export async function registraDocumento(
  db: Database,
  input: NuovoDocumento,
): Promise<{ id: string }> {
  const { categoria, descrizione } = documentoDatiSchema.parse({
    categoria: input.categoria,
    descrizione: input.descrizione,
  });
  return db.transaction(async (tx) => {
    const [p] = await tx
      .select({ id: progetti.id })
      .from(progetti)
      .where(and(eq(progetti.id, input.progettoId), isNull(progetti.deletedAt)));
    if (!p) throw new Error("Progetto non trovato");
    if (input.ticketId) {
      const [t] = await tx
        .select({ id: ticket.id })
        .from(ticket)
        .where(
          and(
            eq(ticket.id, input.ticketId),
            eq(ticket.progettoId, input.progettoId),
            isNull(ticket.deletedAt),
          ),
        );
      if (!t) throw new Error("Il ticket non appartiene a questo progetto");
    }
    const [d] = await tx
      .insert(progettoDocumenti)
      .values({
        id: input.id,
        progettoId: input.progettoId,
        ticketId: input.ticketId ?? null,
        nome: input.nome,
        chiave: input.chiave,
        dimensioneByte: input.dimensioneByte,
        tipoMime: input.tipoMime || "application/octet-stream",
        categoria,
        descrizione,
        caricatoDaId: input.caricatoDaId ?? null,
      })
      .returning({ id: progettoDocumenti.id });
    if (!d) throw new Error("Registrazione del documento non riuscita");
    await tx
      .update(progetti)
      .set({ updatedAt: new Date() })
      .where(eq(progetti.id, input.progettoId));
    return d;
  });
}

/** I documenti di un progetto (o di un suo ticket), dal più recente. */
export async function documentiDelProgetto(
  db: Database,
  progettoId: string,
  opzioni: { ticketId?: string } = {},
) {
  return db
    .select({ d: progettoDocumenti, caricatoDa: users.name })
    .from(progettoDocumenti)
    .leftJoin(users, eq(users.id, progettoDocumenti.caricatoDaId))
    .where(
      and(
        eq(progettoDocumenti.progettoId, progettoId),
        isNull(progettoDocumenti.deletedAt),
        opzioni.ticketId ? eq(progettoDocumenti.ticketId, opzioni.ticketId) : undefined,
      ),
    )
    .orderBy(desc(progettoDocumenti.createdAt));
}

export async function documentoPerId(db: Database, id: string) {
  const [d] = await db
    .select()
    .from(progettoDocumenti)
    .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)));
  return d ?? null;
}

/** Segna il documento come eliminato e ritorna la chiave dell'oggetto da togliere dal bucket. */
export async function eliminaDocumento(
  db: Database,
  id: string,
): Promise<{ progettoId: string; nome: string; chiave: string }> {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(progettoDocumenti)
      .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)))
      .for("update");
    if (!d) throw new Error("Documento non trovato");
    await tx
      .update(progettoDocumenti)
      .set({ deletedAt: new Date() })
      .where(eq(progettoDocumenti.id, id));
    await tx.update(progetti).set({ updatedAt: new Date() }).where(eq(progetti.id, d.progettoId));
    return { progettoId: d.progettoId, nome: d.nome, chiave: d.chiave };
  });
}

/** Cambia categoria, descrizione e ticket a cui è allegato (`null` lo stacca); il file non si tocca. */
export async function modificaDocumento(
  db: Database,
  id: string,
  input: { categoria?: string; descrizione?: string | null; ticketId?: string | null },
): Promise<{ progettoId: string }> {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(progettoDocumenti)
      .where(and(eq(progettoDocumenti.id, id), isNull(progettoDocumenti.deletedAt)))
      .for("update");
    if (!d) throw new Error("Documento non trovato");
    const parsed = documentoDatiSchema.parse({
      categoria: input.categoria ?? d.categoria,
      descrizione: input.descrizione === undefined ? d.descrizione : input.descrizione,
    });
    if (input.ticketId) {
      const [t] = await tx
        .select({ id: ticket.id })
        .from(ticket)
        .where(
          and(
            eq(ticket.id, input.ticketId),
            eq(ticket.progettoId, d.progettoId),
            isNull(ticket.deletedAt),
          ),
        );
      if (!t) throw new Error("Il ticket non appartiene a questo progetto");
    }
    await tx
      .update(progettoDocumenti)
      .set({
        categoria: parsed.categoria,
        descrizione: parsed.descrizione,
        ...(input.ticketId !== undefined && { ticketId: input.ticketId }),
      })
      .where(eq(progettoDocumenti.id, id));
    return { progettoId: d.progettoId };
  });
}

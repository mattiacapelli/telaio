import {
  codiceTicket,
  commentoTicketSchema,
  posizioneTra,
  type StatoTicket,
  type TicketDati,
  ticketDatiSchema,
} from "@telaio/core";
import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import type { Database } from "./client";
import { progetti, progettoDocumenti, ticket, ticketCommenti, users } from "./schema";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

async function verificaUtente(tx: Tx, id: string | null, chi: string) {
  if (!id) return;
  const [u] = await tx.select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!u) throw new Error(`${chi} non esiste`);
}

/** Posizione in fondo alla colonna: sotto tutti gli altri ticket di quello stato. */
async function inFondo(tx: Tx, progettoId: string, stato: StatoTicket, tranne?: string) {
  const [r] = await tx
    .select({ max: sql<number | null>`max(${ticket.posizione})` })
    .from(ticket)
    .where(
      and(
        eq(ticket.progettoId, progettoId),
        eq(ticket.stato, stato),
        isNull(ticket.deletedAt),
        tranne ? ne(ticket.id, tranne) : undefined,
      ),
    );
  return posizioneTra(r?.max ?? null, null) as number;
}

/** Il momento di chiusura segue la colonna: entrare in «completato» lo fissa, uscirne lo toglie. */
function completatoAt(da: StatoTicket | null, a: StatoTicket, attuale: Date | null): Date | null {
  if (a !== "completato") return null;
  return da === "completato" ? attuale : new Date();
}

export async function creaTicket(
  db: Database,
  progettoId: string,
  input: TicketDati | unknown,
  segnalatoreId: string | null,
): Promise<{ id: string; numero: number; codice: string }> {
  const dati = ticketDatiSchema.parse(input);
  return db.transaction(async (tx) => {
    const [p] = await tx
      .update(progetti)
      .set({ ultimoTicket: sql`${progetti.ultimoTicket} + 1`, updatedAt: new Date() })
      .where(and(eq(progetti.id, progettoId), isNull(progetti.deletedAt)))
      .returning({ codice: progetti.codice, numero: progetti.ultimoTicket });
    if (!p) throw new Error("Progetto non trovato");
    await verificaUtente(tx, dati.assegnatarioId, "L'assegnatario scelto");
    const [creato] = await tx
      .insert(ticket)
      .values({
        ...dati,
        progettoId,
        numero: p.numero,
        segnalatoreId,
        posizione: await inFondo(tx, progettoId, dati.stato),
        completatoAt: completatoAt(null, dati.stato, null),
      })
      .returning({ id: ticket.id, numero: ticket.numero });
    if (!creato) throw new Error("Creazione del ticket non riuscita");
    return { ...creato, codice: codiceTicket(p.codice, creato.numero) };
  });
}

export interface EsitoModificaTicket {
  codice: string;
  cambioStato: { da: StatoTicket; a: StatoTicket } | null;
}

export async function modificaTicket(
  db: Database,
  id: string,
  input: TicketDati | unknown,
): Promise<EsitoModificaTicket> {
  const dati = ticketDatiSchema.parse(input);
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select({ t: ticket, codice: progetti.codice })
      .from(ticket)
      .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
      .where(and(eq(ticket.id, id), isNull(ticket.deletedAt)))
      .for("update", { of: ticket });
    if (!att) throw new Error("Ticket non trovato");
    await verificaUtente(tx, dati.assegnatarioId, "L'assegnatario scelto");
    const cambia = att.t.stato !== dati.stato;
    await tx
      .update(ticket)
      .set({
        ...dati,
        ...(cambia && { posizione: await inFondo(tx, att.t.progettoId, dati.stato, id) }),
        completatoAt: completatoAt(att.t.stato, dati.stato, att.t.completatoAt),
      })
      .where(eq(ticket.id, id));
    return {
      codice: codiceTicket(att.codice, att.t.numero),
      cambioStato: cambia ? { da: att.t.stato, a: dati.stato } : null,
    };
  });
}

/** Riscrive le posizioni di una colonna a passi regolari, nell'ordine attuale. */
async function riordinaColonna(tx: Tx, progettoId: string, stato: StatoTicket) {
  const righe = await tx
    .select({ id: ticket.id })
    .from(ticket)
    .where(
      and(eq(ticket.progettoId, progettoId), eq(ticket.stato, stato), isNull(ticket.deletedAt)),
    )
    .orderBy(asc(ticket.posizione), asc(ticket.numero));
  for (const [i, r] of righe.entries())
    await tx
      .update(ticket)
      .set({ posizione: (i + 1) * 1000 })
      .where(eq(ticket.id, r.id));
}

/**
 * Sposta un ticket sulla lavagna: in una colonna (`stato`), sopra il ticket `primaDi` oppure in
 * fondo se è `null`. Funziona anche dentro la stessa colonna, per riordinarla.
 */
export async function spostaTicket(
  db: Database,
  id: string,
  dove: { stato: StatoTicket; primaDi: string | null },
): Promise<{ codice: string; cambioStato: { da: StatoTicket; a: StatoTicket } | null }> {
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select({ t: ticket, codice: progetti.codice })
      .from(ticket)
      .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
      .where(and(eq(ticket.id, id), isNull(ticket.deletedAt)))
      .for("update", { of: ticket });
    if (!att) throw new Error("Ticket non trovato");
    const { progettoId } = att.t;
    if (dove.primaDi === id) throw new Error("Un ticket non si può mettere prima di se stesso");

    const calcola = async () => {
      const colonna = await tx
        .select({ id: ticket.id, posizione: ticket.posizione })
        .from(ticket)
        .where(
          and(
            eq(ticket.progettoId, progettoId),
            eq(ticket.stato, dove.stato),
            isNull(ticket.deletedAt),
            ne(ticket.id, id),
          ),
        )
        .orderBy(asc(ticket.posizione), asc(ticket.numero));
      if (dove.primaDi === null)
        return posizioneTra(colonna.at(-1)?.posizione ?? null, null) as number;
      const i = colonna.findIndex((c) => c.id === dove.primaDi);
      if (i < 0) throw new Error("Il ticket di riferimento non è in quella colonna");
      return posizioneTra(colonna[i - 1]?.posizione ?? null, colonna[i]?.posizione ?? null);
    };

    let posizione = await calcola();
    if (posizione === null) {
      await riordinaColonna(tx, progettoId, dove.stato);
      posizione = await calcola();
      if (posizione === null) throw new Error("Riordino della colonna non riuscito");
    }
    await tx
      .update(ticket)
      .set({
        stato: dove.stato,
        posizione,
        completatoAt: completatoAt(att.t.stato, dove.stato, att.t.completatoAt),
      })
      .where(eq(ticket.id, id));
    return {
      codice: codiceTicket(att.codice, att.t.numero),
      cambioStato: att.t.stato === dove.stato ? null : { da: att.t.stato, a: dove.stato },
    };
  });
}

/** I ticket non si cancellano davvero: restano per lo storico, fuori dalla lavagna. */
export async function eliminaTicket(
  db: Database,
  id: string,
): Promise<{ progettoId: string; codice: string }> {
  return db.transaction(async (tx) => {
    const [att] = await tx
      .select({ t: ticket, codice: progetti.codice })
      .from(ticket)
      .innerJoin(progetti, eq(progetti.id, ticket.progettoId))
      .where(and(eq(ticket.id, id), isNull(ticket.deletedAt)))
      .for("update", { of: ticket });
    if (!att) throw new Error("Ticket non trovato");
    await tx.update(ticket).set({ deletedAt: new Date() }).where(eq(ticket.id, id));
    return { progettoId: att.t.progettoId, codice: codiceTicket(att.codice, att.t.numero) };
  });
}

export async function commentaTicket(
  db: Database,
  ticketId: string,
  autoreId: string | null,
  input: unknown,
): Promise<{ id: string }> {
  const { testo } = commentoTicketSchema.parse(input);
  return db.transaction(async (tx) => {
    const [t] = await tx
      .select({ id: ticket.id })
      .from(ticket)
      .where(and(eq(ticket.id, ticketId), isNull(ticket.deletedAt)));
    if (!t) throw new Error("Ticket non trovato");
    const [c] = await tx
      .insert(ticketCommenti)
      .values({ ticketId, autoreId, testo })
      .returning({ id: ticketCommenti.id });
    if (!c) throw new Error("Commento non salvato");
    await tx.update(ticket).set({ updatedAt: new Date() }).where(eq(ticket.id, ticketId));
    return c;
  });
}

export async function eliminaCommento(db: Database, commentoId: string): Promise<void> {
  const eliminati = await db
    .delete(ticketCommenti)
    .where(eq(ticketCommenti.id, commentoId))
    .returning({ id: ticketCommenti.id });
  if (eliminati.length === 0) throw new Error("Commento non trovato");
}

// ── Letture ──────────────────────────────────────────────────────────────────────────────────

/** I ticket di un progetto, già nell'ordine della lavagna (colonna per colonna, dall'alto). */
export async function ticketDelProgetto(db: Database, progettoId: string) {
  const righe = await db
    .select({
      t: ticket,
      assegnatario: users.name,
      documenti: sql<number>`(select count(*)::int from ${progettoDocumenti} d where d.ticket_id = ${ticket.id} and d.deleted_at is null)`,
      commenti: sql<number>`(select count(*)::int from ${ticketCommenti} c where c.ticket_id = ${ticket.id})`,
    })
    .from(ticket)
    .leftJoin(users, eq(users.id, ticket.assegnatarioId))
    .where(and(eq(ticket.progettoId, progettoId), isNull(ticket.deletedAt)))
    .orderBy(asc(ticket.posizione), asc(ticket.numero));
  return righe;
}
